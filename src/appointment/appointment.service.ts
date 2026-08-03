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
import { AppointmentStatus } from './appointment.entity';
import { ForbiddenException } from '@nestjs/common';

import { Appointment } from './appointment.entity';
import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';
import { CustomAvailability } from '../custom-availability/entities/custom-availability.entity';
import {
  RecurringAvailability,
  SchedulingType,
} from '../recurring-availability/entities/recurring-availability.entity';
import { Day } from '../enums/day.enum';

@Injectable()
export class AppointmentService {
  async getAvailableSlots(
    doctorId: number,
    date: string,
  ) {
    const doctor = await this.doctorRepository.findOne({
      where: {
        id: doctorId,
      },
      relations: {
        user: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (isNaN(new Date(date).getTime())) {
      throw new BadRequestException('Invalid date');
    }

    const days = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];

// ==============================
// SMART DATE RESOLUTION
// ==============================

// 1. Check custom availability first
const customAvailability =
  await this.customAvailabilityRepository.findOne({
    where: {
      doctor: {
        id: doctorId,
      },
      date,
    },
    relations: {
      doctor: true,
    },
  });

let availability: any;

if (customAvailability) {
  const day = days[
    new Date(date).getUTCDay()
  ] as Day;

  const recurringAvailability =
    await this.availabilityRepository.findOne({
      where: {
        doctor: {
          id: doctorId,
        },
        day,
      },
      relations: {
        doctor: true,
      },
    });

  if (!recurringAvailability) {
    throw new NotFoundException(
      'Recurring availability not found',
    );
  }

  // Override only the time range
  availability = {
    ...recurringAvailability,
    startTime: customAvailability.startTime,
    endTime: customAvailability.endTime,
  };
} else {
  const day = days[
    new Date(date).getUTCDay()
  ] as Day;

  availability =
    await this.availabilityRepository.findOne({
      where: {
        doctor: {
          id: doctorId,
        },
        day,
      },
      relations: {
        doctor: true,
      },
    });
}

    if (!availability) {
      throw new NotFoundException(
        'Doctor is not available on this date',
      );
    }

    // =======================
    // STREAM SCHEDULING
    // =======================
    if (
      availability.schedulingType ===
      SchedulingType.STREAM
    ) {
      const booked = await this.appointmentRepository.count({
        where: {
          recurringAvailability: {
            id: availability.id,
          },
          appointmentDate: date,
          status: AppointmentStatus.BOOKED,
        },
      });

<<<<<<< Updated upstream
  const availableSlots = slots.map((slot) => ({
    startTime: slot.startTime,
    endTime: slot.endTime,
    available: !bookedAppointments.some(
      (appointment) =>
        appointment.slotStartTime ===
        slot.startTime,
    ),
  }));
=======
      return {
        schedulingType: SchedulingType.STREAM,
        availabilityId: availability.id,
        date,
        startTime: availability.startTime,
        endTime: availability.endTime,
        capacity: availability.capacity,
        booked,
        remaining:
          (availability.capacity ?? 0) - booked,
      };
    }

    // =======================
    // WAVE SCHEDULING
    // =======================
    const slots = this.generateWaveSlots(
      availability.startTime,
      availability.endTime,
      availability.slotDuration!,
      availability.bufferTime ?? 0,
    );

    const bookedAppointments =
      await this.appointmentRepository.find({
        where: {
          recurringAvailability: {
            id: availability.id,
          },
          appointmentDate: date,
          status: AppointmentStatus.BOOKED,
        },
      });

    const availableSlots = slots.map((slot) => {

      const booked = bookedAppointments.filter(
        appointment =>
          appointment.slotStartTime?.substring(0, 5) === slot.startTime,
      ).length;

      const capacity = availability.capacity ?? 1;
      const remaining = capacity - booked;

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity,
        booked,
        remaining,
        available: remaining > 0,
      };
    });
>>>>>>> Stashed changes

    return {
      schedulingType: SchedulingType.WAVE,
      availabilityId: availability.id,
      date,
      slots: availableSlots,
    };
  }

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(RecurringAvailability)
    private readonly availabilityRepository: Repository<RecurringAvailability>,

    @InjectRepository(CustomAvailability)
private readonly customAvailabilityRepository: Repository<CustomAvailability>,
  ) { }

  async bookAppointment(
    doctorId: number,
    patientId: number,
    availabilityId: number,
    appointmentDate: string,
    slotStartTime?: string,
  ) {
    const doctor = await this.doctorRepository.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    console.log('Received patientId:', patientId);

    const allPatients = await this.patientRepository.find({
      relations: {
        user: true,
      },
    });

    console.log('All patients:', allPatients);

    const patient = await this.patientRepository.findOne({
      where: {
        id: patientId,
      },
      relations: {
        user: true,
      },
    });

    console.log('Found patient:', patient);

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const availability =
      await this.availabilityRepository.findOne({
        where: {
          id: availabilityId,
          doctor: {
            id: doctorId,
          },
        },
<<<<<<< Updated upstream
    },
    relations:{
        doctor:true,
    },
});
    if (!availability) throw new NotFoundException('Availability not found');
=======
        relations: {
          doctor: true,
        },
      });
    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    if (
      availability.schedulingType === SchedulingType.STREAM &&
      slotStartTime
    ) {
      throw new BadRequestException(
        'slotStartTime should not be provided for STREAM scheduling',
      );
    }

    if (
      availability.schedulingType === SchedulingType.WAVE &&
      !slotStartTime
    ) {
      throw new BadRequestException(
        'slotStartTime is required for WAVE scheduling',
      );
    }
>>>>>>> Stashed changes

    const bookingTime =
      availability.schedulingType === SchedulingType.STREAM
        ? availability.startTime
        : slotStartTime;

    const appointmentDateTime = new Date(
      `${appointmentDate}T${bookingTime}`,
    );

    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException(
        'Appointment must be scheduled for a future date and time.',
      );
    }

    const days = [
      'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
      'THURSDAY', 'FRIDAY', 'SATURDAY',
    ];
    const appointmentDay = days[new Date(appointmentDate).getUTCDay()] as Day;
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

    if (
      duplicate &&
      duplicate.status !== AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Appointment already booked',
      );
    }

    if (availability.schedulingType === SchedulingType.STREAM) {
      const bookedPatients =
        await this.appointmentRepository.count({
          where: {
            recurringAvailability: { id: availabilityId },
            appointmentDate,
            status: AppointmentStatus.BOOKED,
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

<<<<<<< Updated upstream
const existing =
await this.appointmentRepository.findOne({
    where:{
        recurringAvailability:{id:availabilityId},
        appointmentDate,
        slotStartTime,
        status: AppointmentStatus.BOOKED,
    },
});

      if (existing) {
        throw new BadRequestException('Slot already booked');
=======

      const bookedCount =
        await this.appointmentRepository.count({
          where: {
            recurringAvailability: { id: availabilityId },
            appointmentDate,
            slotStartTime,
            status: AppointmentStatus.BOOKED,
          },
        });

      if (bookedCount >= (availability.capacity ?? 0)) {
        throw new BadRequestException(
          'Selected slot is full',
        );
>>>>>>> Stashed changes
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
        startTime: current.toTimeString().slice(0, 5),
        endTime: slotEnd.toTimeString().slice(0, 5),
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



  async findPatientAppointments(patientId: number) {
    const appointments = await this.appointmentRepository.find({
      where: {
        patient: {
          id: patientId,
        },
      },
      relations: {
        doctor: true,
        recurringAvailability: true,
      },
      order: {
        appointmentDate: 'ASC',
        createdAt: 'ASC',
      },
    });

    if (!appointments.length) {
      throw new NotFoundException('No appointments found');
    }

    return appointments;
  }

  async findDoctorAppointments(doctorId: number) {
    const appointments = await this.appointmentRepository.find({
      where: {
        doctor: {
          id: doctorId,
        },
      },
      relations: {
        patient: true,
        recurringAvailability: true,
      },
      order: {
        appointmentDate: 'ASC',
        createdAt: 'ASC',
      },
    });

    if (!appointments.length) {
      throw new NotFoundException('No appointments found');
    }

    return appointments;
  }

  async cancelAppointment(
    appointmentId: number,
    patientId: number,
  ) {
    const appointment =
      await this.appointmentRepository.findOne({
        where: {
          id: appointmentId,
        },
        relations: {
          patient: true,
        },
      });

    if (!appointment) {
      throw new NotFoundException(
        'Appointment not found',
      );
    }

    if (appointment.patient.id !== patientId) {
      throw new ForbiddenException(
        'You can only cancel your own appointment',
      );
    }

    if (
      appointment.status ===
      AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Appointment is already cancelled',
      );
    }

    const appointmentDateTime = new Date(
      `${appointment.appointmentDate}T${appointment.slotStartTime ??
      '00:00'
      }:00`,
    );

    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException(
        'Past appointments cannot be cancelled',
      );
    }

    appointment.status =
      AppointmentStatus.CANCELLED;

    return this.appointmentRepository.save(
      appointment,
    );
  }


}
