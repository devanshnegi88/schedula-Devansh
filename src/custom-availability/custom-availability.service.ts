import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CustomAvailability } from './entities/custom-availability.entity';
import { Doctor } from '../doctor/doctor.entity';




import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { RecurringAvailability } from '../recurring-availability/entities/recurring-availability.entity';



@Injectable()
export class CustomAvailabilityService {
  constructor(
    @InjectRepository(CustomAvailability)
    private readonly customRepository: Repository<CustomAvailability>,

    @InjectRepository(RecurringAvailability)
    private readonly recurringRepository: Repository<RecurringAvailability>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
  ) {}

  async create(
    doctorId: number,
    dto: CreateCustomAvailabilityDto,
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

    const existing = await this.customRepository.find({
      where: {
        doctor: {
          user: {
            id: doctorId,
          },
        },
        date: dto.date,
      },
      relations: {
  doctor: true,
}
    });

    for (const slot of existing) {
      const overlap =
        dto.startTime < slot.endTime &&
        dto.endTime > slot.startTime;

      if (overlap) {
        throw new ConflictException(
          'Time slot overlaps with existing availability',
        );
      }
    }

    const availability = this.customRepository.create({
      ...dto,
      doctor,
    });

    return this.customRepository.save(availability);
  }

  async findByDate(
  doctorId: number,
  date: string,
) {
  const custom = await this.customRepository.find({
    where: {
      doctor: {
        user: {
          id: doctorId,
        },
      },
      date,
    },
    relations: {
  doctor: true,
},
    order: {
      startTime: 'ASC',
    },
  });

  if (custom.length > 0) {
    return {
      source: 'CUSTOM',
      availability: custom,
    };
  }

  const day = new Date(date)
    .toLocaleDateString('en-US', {
      weekday: 'long',
    })
    .toUpperCase();

  const recurring =
    await this.recurringRepository.find({
      where: {
        doctor: {
          user: {
            id: doctorId,
          },
        },
        day: day as any,
      },
      relations: {
        doctor: {
          user: true,
        },
      },
      order: {
        startTime: 'ASC',
      },
    });

  return {
    source: 'RECURRING',
    availability: recurring,
  };
}}