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

    for (const slot of existing) {
      const overlap =
        dto.startTime < slot.endTime &&
        dto.endTime > slot.startTime;

      if (overlap) {
        throw new ConflictException(
          'Availability overlaps with an existing slot',
        );
      }
    }

    const duplicate = await this.recurringRepository.findOne({
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

    const availability = this.recurringRepository.create({
      ...dto,
      doctor,
    });

    const saved =
      await this.recurringRepository.save(
        availability,
      );

    let slots: {
      startTime: string;
      endTime: string;
    }[] = [];

    if (
      saved.schedulingType ===
      SchedulingType.WAVE
    ) {
      if (
        !saved.capacity ||
        saved.capacity <= 0
      ) {
        throw new BadRequestException(
          'Capacity is required for WAVE scheduling',
        );
      }

      return {
        ...saved,
        available: `${saved.capacity}/${saved.capacity}`,
        tokenBased: true,
      };
    }

    if (
      saved.schedulingType ===
      SchedulingType.STREAM
    ) {
      if (!saved.slotDuration) {
        throw new BadRequestException(
          'Slot duration is required for STREAM scheduling',
        );
      }

      slots = this.generateStreamSlots(
        saved.startTime,
        saved.endTime,
        saved.slotDuration,
        saved.bufferTime ?? 0,
      );
    }

    return {
      ...saved,
      slots,
    };
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
      },
      order: {
        day: 'ASC',
      },
    });
  }

  private generateStreamSlots(
    startTime: string,
    endTime: string,
    slotDuration: number,
    bufferTime: number,
  ) {
    const slots: {
      startTime: string;
      endTime: string;
    }[] = [];

    const start = new Date(
      `1970-01-01T${startTime}`,
    );

    const end = new Date(
      `1970-01-01T${endTime}`,
    );

    let current = new Date(start);

    while (true) {
      const slotEnd = new Date(
        current.getTime() +
          slotDuration * 60000,
      );

      if (slotEnd > end) {
        break;
      }

      slots.push({
        startTime: current
          .toTimeString()
          .slice(0, 5),
        endTime: slotEnd
          .toTimeString()
          .slice(0, 5),
      });

      current = new Date(
        slotEnd.getTime() +
          bufferTime * 60000,
      );
    }

    return slots;
  }

  async findOne(id: number) {
    const availability =
      await this.recurringRepository.findOne({
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

    return availability;
  }

  async update(
    id: number,
    dto: UpdateRecurringAvailabilityDto,
  ) {
    const availability =
      await this.findOne(id);

    Object.assign(availability, dto);

    return this.recurringRepository.save(
      availability,
    );
  }

  async remove(id: number) {
    const availability =
      await this.findOne(id);

    await this.recurringRepository.remove(
      availability,
    );

    return {
      message:
        'Recurring availability deleted successfully',
    };
  }
}