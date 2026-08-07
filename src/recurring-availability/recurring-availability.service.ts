import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { RecurringAvailability } from './entities/recurring-availability.entity';
import { SchedulingType } from './entities/recurring-availability.entity';
import { Doctor } from '../doctor/doctor.entity';
import { ElasticSchedulingService } from '../appointment/elastic-scheduling.service';
import {
  appointment,
  appointmentStatus,
} from '../appointment/appointment.entity';
import { appointmentService } from '../appointment/appointment.service';

import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { ShrinkAvailabilityDto } from './dto/shrink-availability.dto';
import { ExpandAvailabilityDto } from './dto/expand-availability.dto';

@Injectable()
export class RecurringAvailabilityService {
  remove(id: number) {
    throw new Error('Method not implemented.');
  }
  constructor(
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepository: Repository<RecurringAvailability>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,

private readonly appointmentService: appointmentService,

private readonly elasticSchedulingService: ElasticSchedulingService,

private readonly dataSource: DataSource,
  ) { }


  private validateAvailabilityUpdateWindow(
  availability: RecurringAvailability,
): void {

  const now = new Date();

  const today = now
    .toLocaleDateString('en-US', {
      weekday: 'long',
    })
    .toUpperCase();

  // Only restrict today's availability
  if (availability.day !== today) {
    return;
  }

  const [hours, minutes] =
    availability.startTime
      .split(':')
      .map(Number);

  const startTime = new Date(now);

  startTime.setHours(
    hours,
    minutes,
    0,
    0,
  );

  const diffInMilliseconds =
    startTime.getTime() -
    now.getTime();

  const diffInHours =
    diffInMilliseconds /
    (1000 * 60 * 60);

  if (
    diffInHours >= 0 &&
    diffInHours < 2
  ) {

    throw new BadRequestException(
      'Availability cannot be updated within 2 hours of its start time.',
    );

  }

}

  async create(
    doctorId: number,
    dto: CreateRecurringAvailabilityDto,
  ) {
    const doctor = await this.doctorRepository.findOne({
      where: {
        user: {
          id: doctorId,
        },
      },
      relations: {
        user: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException(
        'Start time must be before end time',
      );
    }

    for (const day of dto.days) {

  const existing =
    await this.recurringRepository.find({
      where: {
        doctor: {
          user: {
            id: doctorId,
          },
        },
        day,
      },
      relations: {
        doctor: {
          user: true,
        },
      },
    });

  for (const availability of existing) {

    const overlap =
      dto.startTime < availability.endTime &&
      dto.endTime > availability.startTime;

    if (overlap) {
      throw new ConflictException(
        `Availability overlaps on ${day}`,
      );
    }
  }

}

    for (const day of dto.days) {

  const duplicate =
    await this.recurringRepository.findOne({
      where: {
        doctor: {
          user: {
            id: doctorId,
          },
        },
        day,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      relations: {
        doctor: true,
      },
    });

  if (duplicate) {
    throw new ConflictException(
      `Duplicate availability already exists for ${day}`,
    );
  }

}

    // ===================================
    // STREAM VALIDATION
    // ===================================

    if (
      dto.schedulingType ===
      SchedulingType.STREAM
    ) {
      if (!dto.capacity || dto.capacity <= 0) {
        throw new BadRequestException(
          'Capacity must be greater than 0',
        );
      }


      if (dto.slotDuration) {
        throw new BadRequestException(
          'slotDuration should not be provided for STREAM scheduling',
        );
      }

      dto.slotDuration = undefined;
      dto.bufferTime = 0;
    }

    // ===================================
    // WAVE VALIDATION
    // ===================================

    if (
      dto.schedulingType ===
      SchedulingType.WAVE
    ) {
      if (
        !dto.slotDuration ||
        dto.slotDuration <= 0
      ) {
        throw new BadRequestException(
          'slotDuration is required for WAVE scheduling',
        );
      }

      if (
        !dto.capacity ||
        dto.capacity <= 0
      ) {
        throw new BadRequestException(
          'Capacity must be greater than 0',
        );
      }

      dto.bufferTime ??= 0;
    }

    const { days, ...availabilityData } = dto;

const savedAvailabilities: any[] = [];

for (const day of days) {

  const availability =
    this.recurringRepository.create({
      ...availabilityData,
      day,
      doctor,
    });

  const saved =
    await this.recurringRepository.save(
      availability,
    );

  if (
    saved.schedulingType ===
    SchedulingType.STREAM
  ) {
    savedAvailabilities.push({
      ...saved,
      appointmentWindow: `${saved.startTime} - ${saved.endTime}`,
      maxCapacity: saved.capacity,
      tokenBased: true,
    });
  } else {

    const slots =
      this.appointmentService.generateWaveSlots(
        saved.startTime,
        saved.endTime,
        saved.slotDuration!,
        saved.bufferTime ?? 0,
      );

    savedAvailabilities.push({
      ...saved,
      slots,
    });

  }

}

return savedAvailabilities;}



  async findAll(doctorId: number) {
    return this.recurringRepository.find({
      where: {
        doctor: {
          user: {
            id: doctorId,
          },
        },
      },
      relations: {
        doctor: true,
        appointments: true,
      },
      order: {
        day: 'ASC',
        startTime: 'ASC',
      },
    });
  }



  async findOne(id: number) {
    const availability =
      await this.recurringRepository.findOne({
        where: {
          id,
        },
        relations: {
          doctor: true,
          appointments: true,
        },
      });

    if (!availability) {
      throw new NotFoundException(
        'Availability not found',
      );
    }

    if (
      availability.schedulingType ===
      SchedulingType.WAVE
    ) {
      return {
        ...availability,
        slots: this.appointmentService.generateWaveSlots(
          availability.startTime,
          availability.endTime,
          availability.slotDuration!,
          availability.bufferTime ?? 0,
        ),
      };
    }

    return availability;
  }

 async update(
  id: number,
  dto: UpdateRecurringAvailabilityDto,
) {

  const availability =
    await this.recurringRepository.findOne({
      where: {
        id,
      },
    });

  if (!availability) {
    throw new NotFoundException(
      'Availability not found',
    );
  }

  const oldStartTime =
    availability.startTime;

  const oldEndTime =
    availability.endTime;

  const newStartTime =
    dto.startTime ??
    oldStartTime;

  const newEndTime =
    dto.endTime ??
    oldEndTime;

  // ============================
  // Detect Shrink
  // ============================

  const isShrink =
    newStartTime > oldStartTime ||
    newEndTime < oldEndTime;

  // ============================
  // Detect Expand
  // ============================

  const isExpand =
    newStartTime < oldStartTime ||
    newEndTime > oldEndTime;

  // ============================
  // SHRINK
  // ============================

  if (isShrink) {

    return this.shrinkAvailability(
      id,
      {
        startTime: newStartTime,
        endTime: newEndTime,
      },
    );

  }

  // ============================
  // EXPAND
  // ============================

  if (isExpand) {

    return this.expandAvailability(
      id,
      {
        startTime: newStartTime,
        endTime: newEndTime,
      },
    );

  }

  // ============================
  // NORMAL UPDATE
  // ============================

  Object.assign(
    availability,
    dto,
  );

  const updated =
    await this.recurringRepository.save(
      availability,
    );

  if (
    updated.schedulingType ===
    SchedulingType.WAVE
  ) {

    return {
      ...updated,
      slots:
        this.appointmentService.generateWaveSlots(
          updated.startTime,
          updated.endTime,
          updated.slotDuration!,
          updated.bufferTime ?? 0,
        ),
    };

  }

  return updated;

}

  async shrinkAvailability(
  id: number,
  dto: ShrinkAvailabilityDto,
) {
  return this.dataSource.transaction(async (manager) => {

    const availability =
      await manager
        .getRepository(RecurringAvailability)
        .findOne({
          where: {
            id,
          },
          relations: {
            doctor: true,
          },
        });

    if (!availability) {
      throw new NotFoundException(
        'Availability not found',
      );
    }

    // Prevent update within 2 hours
    this.validateAvailabilityUpdateWindow(
      availability,
    );

    const oldStartTime =
      availability.startTime;

    const oldEndTime =
      availability.endTime;

    const newStartTime =
      dto.startTime;

    const newEndTime =
      dto.endTime;

    if (newStartTime >= newEndTime) {
      throw new BadRequestException(
        'Start time must be before end time',
      );
    }

    // Ensure this is actually a shrink
    const isShrink =
      newStartTime > oldStartTime ||
      newEndTime < oldEndTime;

    if (!isShrink) {
      throw new BadRequestException(
        'The provided time range is not a shrink.',
      );
    }

    // Find affected appointments BEFORE updating availability
    await this.elasticSchedulingService
      .handleAvailabilityShrink(
        availability,
        newStartTime,
        newEndTime,
        new Date()
          .toISOString()
          .split('T')[0],
        manager,
      );

    // Update availability
    // Update availability first
availability.startTime = newStartTime;
availability.endTime = newEndTime;

await manager.save(availability);

// Now find affected appointments and reschedule
await this.elasticSchedulingService.handleAvailabilityShrink(
  availability,
  newStartTime,
  newEndTime,
  new Date().toISOString().split('T')[0],
  manager,
);

    // Return WAVE slots
    if (
      availability.schedulingType ===
      SchedulingType.WAVE
    ) {

      return {
        ...availability,
        slots:
          this.appointmentService.generateWaveSlots(
            availability.startTime,
            availability.endTime,
            availability.slotDuration!,
            availability.bufferTime ?? 0,
          ),
      };

    }

    // STREAM
    return availability;

  });
}

  async expandAvailability(
  id: number,
  dto: ExpandAvailabilityDto,
) {
  return this.dataSource.transaction(async (manager) => {

    const availability =
      await manager
        .getRepository(RecurringAvailability)
        .findOne({
          where: { id },
          relations: {
            doctor: true,
          },
        });

    if (!availability) {
      throw new NotFoundException(
        'Availability not found',
      );
    }

    this.validateAvailabilityUpdateWindow(
      availability,
    );

    const oldStartTime =
      availability.startTime;

    const oldEndTime =
      availability.endTime;

    const newStartTime =
      dto.startTime;

    const newEndTime =
      dto.endTime;

    if (newStartTime >= newEndTime) {
      throw new BadRequestException(
        'Start time must be before end time',
      );
    }

    const isExpand =
      newStartTime < oldStartTime ||
      newEndTime > oldEndTime;

    if (!isExpand) {
      throw new BadRequestException(
        'The provided time range is not an expansion.',
      );
    }

    Object.assign(
      availability,
      dto,
    );

    await manager.save(
      availability,
    );

    await this.elasticSchedulingService
      .handleAvailabilityExpand(
        availability,
        oldStartTime,
        oldEndTime,
        manager,
      );

    if (
      availability.schedulingType ===
      SchedulingType.WAVE
    ) {

      return {
        ...availability,
        slots:
          this.appointmentService.generateWaveSlots(
            availability.startTime,
            availability.endTime,
            availability.slotDuration!,
            availability.bufferTime ?? 0,
          ),
      };

    }

    return availability;

  });
}
}