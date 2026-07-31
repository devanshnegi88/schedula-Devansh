import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RecurringAvailability } from './entities/recurring-availability.entity';
import { SchedulingType } from './entities/recurring-availability.entity';
import { Doctor } from '../doctor/doctor.entity';

import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';

@Injectable()
export class RecurringAvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepository: Repository<RecurringAvailability>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
  ) {}

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

  const existing = await this.recurringRepository.find({
    where: {
      doctor: {
        user: {
          id: doctorId,
        },
      },
      day: dto.day,
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
        'Availability overlaps with an existing slot',
      );
    }
  }

  const duplicate =
    await this.recurringRepository.findOne({
      where: {
        doctor: {
          user: {
            id: doctorId,
          },
        },
        day: dto.day,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      relations: {
        doctor: true,
      },
    });

  if (duplicate) {
    throw new ConflictException(
      'Duplicate availability already exists',
    );
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

  const availability =
    this.recurringRepository.create({
      ...dto,
      doctor,
    });

  const saved =
    await this.recurringRepository.save(
      availability,
    );

  // ===================================
  // STREAM RESPONSE
  // ===================================

  if (
    saved.schedulingType ===
    SchedulingType.STREAM
  ) {
    return {
      ...saved,
      appointmentWindow: `${saved.startTime} - ${saved.endTime}`,
      maxCapacity: saved.capacity,
      tokenBased: true,
    };
  }

  // ===================================
  // WAVE RESPONSE
  // ===================================

  const slots = this.generateWaveSlots(
    saved.startTime,
    saved.endTime,
    saved.slotDuration!,
    saved.bufferTime ?? 0,
  );

  return {
    ...saved,
    slots,
  };
}


private generateWaveSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
  bufferTime: number,
) {
  const slots: {
    startTime: string;
    endTime: string;
  }[] = [];

  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);

  let current = new Date(start);

  while (true) {
    const slotEnd = new Date(current);
    slotEnd.setMinutes(
      slotEnd.getMinutes() + slotDuration,
    );

    if (slotEnd > end) {
      break;
    }

    slots.push({
      startTime: current.toTimeString().slice(0, 5),
      endTime: slotEnd.toTimeString().slice(0, 5),
    });

    current = new Date(
      slotEnd.getTime() + bufferTime * 60000,
    );
  }

  return slots;
}

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
      slots: this.generateWaveSlots(
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
  const availability = await this.findOne(id);

  Object.assign(availability, dto);

  return this.recurringRepository.save(
    availability,
  );
}

  async remove(id: number) {
  const availability = await this.findOne(id);

  await this.recurringRepository.remove(
    availability as RecurringAvailability,
  );

  return {
    message:
      'Recurring availability deleted successfully',
  };
}
}