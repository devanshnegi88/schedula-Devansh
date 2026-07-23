import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RecurringAvailability } from './entities/recurring-availability.entity';
import { Doctor } from '../doctor/doctor.entity';

import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { Day } from '../enums/day.enum';

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

    // Validate time range
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException(
        'Start time must be before end time',
      );
    }

    // Check overlapping slots
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

    // Duplicate check
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
}
    });

    if (duplicate) {
      throw new ConflictException(
        'Duplicate availability already exists',
      );
    }

    const availability =
      this.recurringRepository.create({
        ...dto,
        doctor,
      });

    return await this.recurringRepository.save(
      availability,
    );
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

  async findOne(id: number) {
    const availability =
      await this.recurringRepository.findOne({
        where: { id },
        relations: {
  doctor: true,
}
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
    const availability = await this.findOne(id);

    Object.assign(availability, dto);

    return this.recurringRepository.save(
      availability,
    );
  }

  async remove(id: number) {
    const availability = await this.findOne(id);

    await this.recurringRepository.remove(
      availability,
    );

    return {
      message:
        'Recurring availability deleted successfully',
    };
  }
}