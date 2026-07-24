import {
  Injectable,
  BadRequestException,
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
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new BadRequestException('Doctor not found');
    }

    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });

    if (!patient) {
      throw new BadRequestException('Patient not found');
    }

    const availability = await this.availabilityRepository.findOne({
      where: { id: availabilityId },
    });

    if (!availability) {
      throw new BadRequestException('Availability not found');
    }

    // Prevent same patient from booking same availability twice
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
      throw new BadRequestException(
        'Appointment already booked',
      );
    }

    // =========================
    // WAVE Scheduling
    // =========================
    if (availability.schedulingType === SchedulingType.WAVE) {
      const count = await this.appointmentRepository.count({
        where: {
          recurringAvailability: {
            id: availabilityId,
          },
          appointmentDate,
        },
        relations: {
          recurringAvailability: true,
        },
      });

      if (count >= (availability.capacity ?? 0)) {
        throw new BadRequestException('Wave is full');
      }

      const appointment = this.appointmentRepository.create({
        doctor,
        patient,
        recurringAvailability: availability,
        appointmentDate,
        slotStartTime: availability.startTime,
        slotEndTime: availability.endTime,
        tokenNumber: count + 1,
      });

      return await this.appointmentRepository.save(
        appointment,
      );
    }

    // =========================
    // STREAM Scheduling
    // =========================
    if (availability.schedulingType === SchedulingType.STREAM) {
      if (!slotStartTime) {
        throw new BadRequestException(
          'slotStartTime is required',
        );
      }

      // Generate valid slots
      const validSlots = this.generateStreamSlots(
        availability.startTime,
        availability.endTime,
        availability.slotDuration!,
        availability.bufferTime ?? 0,
      );

      const isValid = validSlots.some(
        (slot) => slot.startTime === slotStartTime,
      );

      if (!isValid) {
        throw new BadRequestException(
          'Invalid appointment time',
        );
      }

      const existing =
        await this.appointmentRepository.findOne({
          where: {
            recurringAvailability: {
              id: availabilityId,
            },
            appointmentDate,
            slotStartTime,
          },
          relations: {
            recurringAvailability: true,
          },
        });

      if (existing) {
        throw new BadRequestException(
          'Slot already booked',
        );
      }

      const appointment =
        this.appointmentRepository.create({
          doctor,
          patient,
          recurringAvailability: availability,
          appointmentDate,
          slotStartTime,
          slotEndTime: this.calculateEndTime(
            slotStartTime,
            availability.slotDuration!,
          ),
        });

      return await this.appointmentRepository.save(
        appointment,
      );
    }

    throw new BadRequestException(
      'Invalid scheduling type',
    );
  }

  private calculateEndTime(
    startTime: string,
    duration: number,
  ): string {
    const [hours, minutes] = startTime
      .split(':')
      .map(Number);

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setMinutes(date.getMinutes() + duration);

    return date.toTimeString().slice(0, 5);
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

    const current = new Date();
    const end = new Date();

    const [startHour, startMinute] = startTime
      .split(':')
      .map(Number);
    const [endHour, endMinute] = endTime
      .split(':')
      .map(Number);

    current.setHours(startHour, startMinute, 0, 0);
    end.setHours(endHour, endMinute, 0, 0);

    while (true) {
      const slotEnd = new Date(current);
      slotEnd.setMinutes(
        slotEnd.getMinutes() + slotDuration,
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

      current.setMinutes(
        current.getMinutes() +
          slotDuration +
          bufferTime,
      );
    }

    return slots;
  }
}