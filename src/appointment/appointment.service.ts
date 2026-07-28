// AppointmentService.ts
// NOTE: This file contains the updated booking logic discussed.
// Replace with your project's imports if paths differ.

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Appointment } from './appointment.entity';
import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';
import {
  RecurringAvailability,
  SchedulingType,
} from '../recurring-availability/entities/recurring-availability.entity';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(RecurringAvailability)
    private readonly availabilityRepository: Repository<RecurringAvailability>,
  ) {}

  async bookAppointment(
    doctorId: number,
    patientId: number,
    availabilityId: number,
    appointmentDate: string,
    slotStartTime?: string,
  ) {
    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId }});
    if (!doctor) throw new NotFoundException('Doctor not found');

    const patient = await this.patientRepository.findOne({ where: { id: patientId }});
    if (!patient) throw new NotFoundException('Patient not found');

    const availability = await this.availabilityRepository.findOne({
      where: { id: availabilityId },
    });
    if (!availability) throw new NotFoundException('Availability not found');

    const days = [
      'SUNDAY','MONDAY','TUESDAY','WEDNESDAY',
      'THURSDAY','FRIDAY','SATURDAY',
    ];
    const appointmentDay = days[new Date(appointmentDate).getUTCDay()];
    if (appointmentDay !== availability.day) {
      throw new BadRequestException(
        `Doctor is available only on ${availability.day}.`,
      );
    }

    const duplicate = await this.appointmentRepository.findOne({
      where: {
        patient: { id: patientId },
        recurringAvailability: { id: availabilityId },
        appointmentDate,
      },
      relations: {
        patient: true,
        recurringAvailability: true,
      },
    });

    if (duplicate) {
      throw new BadRequestException('Appointment already booked');
    }

    if (availability.schedulingType === SchedulingType.STREAM) {
      const bookedPatients = await this.appointmentRepository.count({
        where: {
          recurringAvailability: { id: availabilityId },
          appointmentDate,
        },
      });

      if (bookedPatients >= (availability.capacity ?? 0)) {
        throw new BadRequestException('Stream is full');
      }

      return this.appointmentRepository.save(
        this.appointmentRepository.create({
          doctor,
          patient,
          recurringAvailability: availability,
          appointmentDate,
          tokenNumber: bookedPatients + 1,
          slotStartTime: null,
          slotEndTime: null,
        }),
      );
    }

    if (availability.schedulingType === SchedulingType.WAVE) {
      if (!slotStartTime) {
        throw new BadRequestException('slotStartTime is required');
      }

      const slots = this.generateWaveSlots(
        availability.startTime,
        availability.endTime,
        availability.slotDuration!,
        availability.bufferTime ?? 0,
      );

      const selected = slots.find(s => s.startTime === slotStartTime);
      if (!selected) {
        throw new BadRequestException('Invalid appointment slot');
      }

      const existing = await this.appointmentRepository.findOne({
        where: {
          recurringAvailability: { id: availabilityId },
          appointmentDate,
          slotStartTime,
        },
      });

      if (existing) {
        throw new BadRequestException('Slot already booked');
      }

      return this.appointmentRepository.save(
        this.appointmentRepository.create({
          doctor,
          patient,
          recurringAvailability: availability,
          appointmentDate,
          tokenNumber: null,
          slotStartTime: selected.startTime,
          slotEndTime: selected.endTime,
        }),
      );
    }

    throw new BadRequestException('Invalid scheduling type');
  }

  private generateWaveSlots(
    startTime: string,
    endTime: string,
    slotDuration: number,
    bufferTime: number,
  ) {
    const slots: { startTime: string; endTime: string }[] = [];

    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    let current = new Date(start);

    while (true) {
      const slotEnd = new Date(current);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      if (slotEnd > end) break;

      slots.push({
        startTime: current.toTimeString().slice(0,5),
        endTime: slotEnd.toTimeString().slice(0,5),
      });

      current = new Date(slotEnd.getTime() + bufferTime * 60000);
    }

    return slots;
  }

  async findAll() {
    return this.appointmentRepository.find({
      relations: {
        doctor: true,
        patient: true,
        recurringAvailability: true,
      },
      order: {
        appointmentDate: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async findOne(id: number) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: {
        doctor: true,
        patient: true,
        recurringAvailability: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }
}
