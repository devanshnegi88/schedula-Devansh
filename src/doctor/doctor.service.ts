import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Doctor } from './doctor.entity';
import { User } from '../users/user.entity';

import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(userId: number, dto: CreateDoctorDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { doctorProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.doctorProfile) {
      throw new BadRequestException(
        'Doctor profile already exists',
      );
    }

    const doctor = this.doctorRepository.create({
      ...dto,
      user,
    });

    return this.doctorRepository.save(doctor);
  }

  async findOne(userId: number) {
    const doctor = await this.doctorRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
      relations: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found',
      );
    }

    return doctor;
  }

  async update(
    userId: number,
    dto: UpdateDoctorDto,
  ) {
    const doctor = await this.doctorRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
      relations: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found',
      );
    }

    Object.assign(doctor, dto);

    return this.doctorRepository.save(doctor);
  }
}