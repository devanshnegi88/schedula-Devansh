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
import { Doctor } from '../doctor/doctor.entity';

import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { RescheduleappointmentDto } from './reschedule-appointment.dto';

import { Role } from '../users/user.entity';

import { appointmentService } from './appointment.service';
import { CreateappointmentDto } from './create-appointment.dto';

@Controller('appointments')
export class appointmentController {
  constructor(
    private readonly appointmentService: appointmentService,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
  ) {}

  // ============================================================
  // BOOK APPOINTMENT
  // ============================================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async bookAppointment(
    @Body() dto: CreateappointmentDto,
    @Req() req,
  ) {
    const patient =
      await this.patientRepository.findOne({
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
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    // Patient can only book for their own profile
    if (dto.patientId !== patient.id) {
      throw new ForbiddenException(
        'You can only book appointments for your own patient profile',
      );
    }

    return {
      success: true,
      message: 'appointment booked successfully',

      data:
        await this.appointmentService.bookAppointment(
          dto.doctorId,
          dto.patientId,
          dto.availabilityId,
          dto.appointmentDate,
          dto.slotStartTime,
        ),
    };
  }

  // ============================================================
  // GET ALL APPOINTMENTS
  // ============================================================

  @Get()
  async findAll() {
    return this.appointmentService.findAll();
  }

  // ============================================================
  // GET MY APPOINTMENTS
  // ============================================================

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async findMyappointments(@Req() req) {
    const patient =
      await this.patientRepository.findOne({
        where: {
          user: {
            id: req.user.id,
          },
        },
      });

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    return {
      success: true,
      message:
        'Patient appointments fetched successfully',

      data:
        await this.appointmentService
          .findPatientAppointments(
            patient.id,
          ),
    };
  }

  // ============================================================
  // GET DOCTOR APPOINTMENTS
  // ============================================================

  @Get('doctor/appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  async findDoctorappointments(@Req() req) {
    const doctor =
      await this.doctorRepository.findOne({
        where: {
          user: {
            id: req.user.id,
          },
        },
      });

    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found',
      );
    }

    return {
      success: true,
      message:
        'Doctor appointments fetched successfully',

      data:
        await this.appointmentService
          .findDoctorAppointments(
            doctor.id,
          ),
    };
  }

  // ============================================================
  // CANCEL APPOINTMENT
  // PATIENT ONLY
  // ============================================================

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async cancelappointment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
  ) {
    const patient =
      await this.patientRepository.findOne({
        where: {
          user: {
            id: req.user.id,
          },
        },
      });

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    return {
      success: true,
      message:
        'appointment cancelled successfully',

      data:
        await this.appointmentService
          .cancelAppointment(
            id,
            patient.id,
          ),
    };
  }

  // ============================================================
  // RESCHEDULE APPOINTMENT
  // PATIENT ONLY
  // ============================================================

  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async rescheduleappointment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleappointmentDto,
    @Req() req,
  ) {
    const patient =
      await this.patientRepository.findOne({
        where: {
          user: {
            id: req.user.id,
          },
        },
      });

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    return {
      success: true,
      message:
        'appointment rescheduled successfully',

      data:
        await this.appointmentService
          .rescheduleAppointment(
            id,
            patient.id,
            dto,
          ),
    };
  }

  // ============================================================
  // GET AVAILABLE SLOTS
  // ============================================================

  @Get('available-slots')
  async getAvailableSlots(
    @Query('date')
    date: string,

    @Query('doctorId', ParseIntPipe)
    doctorId: number,
  ) {
    return {
      success: true,
      message:
        'Available slots fetched successfully',

      data:
        await this.appointmentService
          .getAvailableSlots(
            doctorId,
            date,
          ),
    };
  }

  // ============================================================
  // GET SINGLE APPOINTMENT
  // ============================================================

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentService.findOne(id);
  }
}