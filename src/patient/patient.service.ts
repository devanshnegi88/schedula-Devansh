import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Patient } from './patient.entity';
import { User } from '../users/user.entity';

import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(userId: number, dto: CreatePatientDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { patientProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.patientProfile) {
      throw new BadRequestException(
        'Patient profile already exists',
      );
    }

    const patient = this.patientRepository.create({
      ...dto,
      user,
    });

    return this.patientRepository.save(patient);
  }

  async findOne(userId: number) {
    const patient = await this.patientRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
      relations: { user: true },
    });

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    return patient;
  }

  async update(
    userId: number,
    dto: UpdatePatientDto,
  ) {
    const patient = await this.patientRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
      relations: { user: true },
    });

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    Object.assign(patient, dto);

    return this.patientRepository.save(patient);
  }
}
