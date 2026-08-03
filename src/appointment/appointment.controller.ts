import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Patient } from '../patient/patient.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Doctor } from '../doctor/doctor.entity';

import { Role } from '../users/user.entity';

import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './create-appointment.dto';
import { Repository } from 'typeorm';


@Controller('appointments')
export class AppointmentController {
  
constructor(
  private readonly appointmentService: AppointmentService,

  @InjectRepository(Patient)
  private readonly patientRepository: Repository<Patient>,

  @InjectRepository(Doctor)
  private readonly doctorRepository: Repository<Doctor>,
) {}

@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PATIENT)
async bookAppointment(
  @Body() dto: CreateAppointmentDto,
  @Req() req,
) {
  const patient = await this.patientRepository.findOne({
    where: {
      user: {
        id: req.user.id,
      },
    },
    relations: {
      user: true,
    },
  });

  if (!patient) {
    throw new NotFoundException('Patient profile not found');
  }

  // Validate that the patientId in the request belongs to the logged-in user
  if (dto.patientId !== patient.id) {
    throw new ForbiddenException(
      'You can only book appointments for your own patient profile',
    );
  }

  return {
    success: true,
    message: 'Appointment booked successfully',
    data: await this.appointmentService.bookAppointment(
      dto.doctorId,
      dto.patientId,
      dto.availabilityId,
      dto.appointmentDate,
      dto.slotStartTime,
    ),
  };
}

  @Get()
  async findAll() {
    return this.appointmentService.findAll();
  }

  @Get('my')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PATIENT)
async findMyAppointments(@Req() req) {
  const patient = await this.patientRepository.findOne({
    where: {
      user: {
        id: req.user.id,
      },
    },
  });

  if (!patient) {
    throw new NotFoundException('Patient profile not found');
  }

  return {
    success: true,
    message: 'Patient appointments fetched successfully',
    data: await this.appointmentService.findPatientAppointments(
      patient.id,
    ),
  };
}

 @Get('doctor/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
async findDoctorAppointments(@Req() req) {
  const doctor = await this.doctorRepository.findOne({
    where: {
      user: {
        id: req.user.id,
      },
    },
  });

  if (!doctor) {
    throw new NotFoundException('Doctor profile not found');
  }

  return {
    success: true,
    message: 'Doctor appointments fetched successfully',
    data: await this.appointmentService.findDoctorAppointments(
      doctor.id,
    ),
  };
}

  @Patch(':id/cancel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PATIENT)
async cancelAppointment(
  @Param('id', ParseIntPipe) id: number,
  @Req() req,
) {
  const patient = await this.patientRepository.findOne({
    where: {
      user: {
        id: req.user.id,
      },
    },
  });

  if (!patient) {
    throw new NotFoundException('Patient profile not found');
  }

  return {
    success: true,
    message: 'Appointment cancelled successfully',
    data: await this.appointmentService.cancelAppointment(
      id,
      patient.id,
    ),
  };
}

@Get('available-slots')
async getAvailableSlots(

  @Query('date')
  date: string,
  @Query('doctorId', ParseIntPipe)
  doctorId: number,
  
) {
  return {
    success: true,
    message: 'Available slots fetched successfully',
    data: await this.appointmentService.getAvailableSlots(
      doctorId,
      date,
    ),
  };
}

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentService.findOne(id);
  }


}