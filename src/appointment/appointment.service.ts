// AppointmentService.ts
// NOTE: This file contains the updated booking logic discussed.
// Replace with your project's imports if paths differ.

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { appointmentStatus } from './appointment.entity';
import { ForbiddenException } from '@nestjs/common';
import { RescheduleappointmentDto } from './reschedule-appointment.dto';


import { appointment } from './appointment.entity';
import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';
import {
  RecurringAvailability,
  SchedulingType,
} from '../recurring-availability/entities/recurring-availability.entity';
import { CustomAvailability } from '../custom-availability/entities/custom-availability.entity';
import { Day } from '../enums/day.enum';

@Injectable()
export class appointmentService{
  // 1. Create a private helper method to resolve availability
  public async resolveAvailability(
  doctorId: number,
  date: string,
  manager?: EntityManager,
){
    // Validate the date
    if (isNaN(new Date(date).getTime())) {
      throw new BadRequestException('Invalid date');
    }

    // Check CustomAvailability by doctor + date
    const customRepo = manager
      ? manager.getRepository(CustomAvailability)
      : this.customAvailabilityRepository;

    const recurringRepo = manager
      ? manager.getRepository(RecurringAvailability)
      : this.availabilityRepository;

    const customAvailability =
      await customRepo.findOne({
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

    const days = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];

    if (customAvailability) {
      const day = days[
        new Date(date).getUTCDay()
      ] as Day;

      const recurringAvailability =
        await recurringRepo.findOne({
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
        await recurringRepo.findOne({
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

    return {
      source: customAvailability ? 'CUSTOM' : 'RECURRING',
      availability,
    };
  }

  // 2. Refactor getAvailableSlots to use resolveAvailability
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

    // Use resolveAvailability() instead of direct queries
    const { source, availability } = await this.resolveAvailability(doctorId, date);


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
          status: appointmentStatus.BOOKED,
        },
      });

      return {
        source,
        schedulingType: availability.schedulingType,
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
          status: appointmentStatus.BOOKED,
        },
      });
      console.log('Requested date:', date);
console.log('Availability ID:', availability.id);
console.log('Booked appointments:', bookedAppointments);

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

    return {

      source,
      schedulingType: availability.schedulingType,
      availabilityId: availability.id,
      date,
      slots: availableSlots,
    };
  }
  constructor(
    @InjectRepository(appointment)
    private readonly appointmentRepository: Repository<appointment>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(RecurringAvailability)
    private readonly availabilityRepository: Repository<RecurringAvailability>,

    @InjectRepository(CustomAvailability)
    private readonly customAvailabilityRepository: Repository<CustomAvailability>,

    private readonly dataSource: DataSource,
  ) { }

  async bookAppointment(
  doctorId: number,
  patientId: number,
  availabilityId: number,
  appointmentDate: string,
  slotStartTime?: string,
) {
  return this.dataSource.transaction(async (manager) => {

    const doctor = await manager.findOne(Doctor, {
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const patient = await manager.findOne(Patient, {
      where: { id: patientId },
      relations: {
        user: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const { source, availability } =
      await this.resolveAvailability(
        doctorId,
        appointmentDate,
        manager,
      );

    if (availability.id !== availabilityId) {
      throw new BadRequestException(
        'Invalid availability ID for requested date',
      );
    }

    if (
      availability.schedulingType ===
        SchedulingType.STREAM &&
      slotStartTime
    ) {
      throw new BadRequestException(
        'slotStartTime should not be provided for STREAM scheduling',
      );
    }

    if (
      availability.schedulingType ===
        SchedulingType.WAVE &&
      !slotStartTime
    ) {
      throw new BadRequestException(
        'slotStartTime is required for WAVE scheduling',
      );
    }

    const bookingTime =
      availability.schedulingType ===
      SchedulingType.STREAM
        ? availability.startTime
        : slotStartTime;

    const appointmentDateTime = new Date(
      `${appointmentDate}T${bookingTime}`,
    );

    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException(
        'Appointment must be scheduled in the future',
      );
    }

    if (source === 'RECURRING') {
      const days = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];

      const appointmentDay =
        days[
          new Date(
            appointmentDate,
          ).getUTCDay()
        ] as Day;

      if (
        appointmentDay !==
        availability.day
      ) {
        throw new BadRequestException(
          `Doctor is available only on ${availability.day}`,
        );
      }
    }

    const duplicate =
      await manager.findOne(appointment, {
        where: {
          patient: {
            id: patientId,
          },
          recurringAvailability: {
            id: availability.id,
          },
          appointmentDate,
        },
        relations: {
          patient: true,
          recurringAvailability: true,
        },
      });

    if (
      duplicate &&
      duplicate.status !==
      appointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Appointment already booked',
      );
    }

        // ==========================
    // STREAM SCHEDULING
    // ==========================
    if (
      availability.schedulingType ===
      SchedulingType.STREAM
    ) {

      await manager
  .createQueryBuilder(
    RecurringAvailability,
    'availability',
  )
  .setLock('pessimistic_write')
  .where('availability.id = :id', {
    id: availability.id,
  })
  .getOne();


      const bookedPatients =
        await manager.getRepository(appointment).count({
          where: {
            recurringAvailability: {
              id: availability.id,
            },
            appointmentDate,
            status: appointmentStatus.BOOKED,
          },
        });

      if (
        bookedPatients >=
        (availability.capacity ?? 0)
      ) {
        const next =
  await this.findNextAvailableStream(
    doctorId,
    appointmentDate,
    manager,
  );

throw new BadRequestException({
  message: 'Stream is full',
  nextAvailable: next,
});
      }

      const newAppointment =
        this.appointmentRepository.create({
          doctor,
          patient,
          recurringAvailability: availability,
          appointmentDate,
          tokenNumber: bookedPatients + 1,
          slotStartTime: null,
          slotEndTime: null,
        });

      return manager.save(newAppointment);
    }

    // ==========================
    // WAVE SCHEDULING
    // ==========================
    if (
      availability.schedulingType ===
      SchedulingType.WAVE
    ) {
      const slots = this.generateWaveSlots(
        availability.startTime,
        availability.endTime,
        availability.slotDuration!,
        availability.bufferTime ?? 0,
      );

      const selected = slots.find(
        (slot) =>
          slot.startTime === slotStartTime,
      );

      if (!selected) {
        throw new BadRequestException(
          'Invalid appointment slot',
        );
      }
       
      await manager
  .createQueryBuilder(
    RecurringAvailability,
    'availability',
  )
  .setLock('pessimistic_write')
  .where('availability.id = :id', {
    id: availability.id,
  })
  .getOne();


      const bookedCount =
        await manager.getRepository(appointment).count({
          where: {
            recurringAvailability: {
              id: availability.id,
            },
            appointmentDate,
            slotStartTime,
            status: appointmentStatus.BOOKED,
          },
        });

      if (
        bookedCount >=
        (availability.capacity ?? 0)
      ) {
        const next =
  await this.findNextAvailableSlot(
    availability,
    appointmentDate,
    manager,
  );

        throw new BadRequestException({
          message: 'Selected slot is full',
          nextAvailable: next,
        });
      }

      const newAppointment =
        this.appointmentRepository.create({
          doctor,
          patient,
          recurringAvailability: availability,
          appointmentDate,
          tokenNumber: null,
          slotStartTime: selected.startTime,
          slotEndTime: selected.endTime,
        });

      return manager.save(newAppointment);
    }

    throw new BadRequestException(
      'Invalid scheduling type',
    );
  });
}


  public generateWaveSlots(
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


public async findNextAvailableSlot(
  availability: RecurringAvailability,
  appointmentDate: string,
  manager: EntityManager,
){

  const appointmentRepository = manager
  ? manager.getRepository(appointment)
  : this.appointmentRepository;

  const slots = this.generateWaveSlots(
    availability.startTime,
    availability.endTime,
    availability.slotDuration!,
    availability.bufferTime ?? 0,
  );

  for (const slot of slots) {
    const booked =
      await appointmentRepository.count({
        where: {
          recurringAvailability: {
            id: availability.id,
          },
          appointmentDate,
          slotStartTime: slot.startTime,
          status: appointmentStatus.BOOKED,
        },
      });

    if (booked < (availability.capacity ?? 1)) {
      return slot;
    }
  }

  return null;
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
      recurringAvailability: true,
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
    appointmentStatus.CANCELLED
  ) {
    throw new BadRequestException(
      'Appointment is already cancelled',
    );
  }

  // const appointmentWithAvailability =
  //   await this.appointmentRepository.findOne({
  //     where: {
  //       id: appointmentId,
  //     },
  //     relations: {
  //       recurringAvailability: true,
  //     },
  //   });

  const appointmentTime =
  appointment.slotStartTime ??
  appointment.recurringAvailability.startTime;

  const appointmentDateTime = new Date(
    `${appointment.appointmentDate}T${appointmentTime}`,
  );

  const difference =
    appointmentDateTime.getTime() - Date.now();

  if (difference < 30 * 60 * 1000) {
    throw new BadRequestException(
      'Appointments cannot be cancelled within 30 minutes',
    );
  }

  appointment.status =
    appointmentStatus.CANCELLED;

  return this.appointmentRepository.save(
    appointment,
  );
}

async rescheduleAppointment(
  appointmentId: number,
  patientId: number,
  dto: RescheduleappointmentDto,
) {
  return this.dataSource.transaction(async (manager) => {

    // const lockedAppointment = await manager
    //   .createQueryBuilder(appointment, 'appointment')
    //   .setLock('pessimistic_write')
    //   .where('appointment.id = :id', {
    //     id: appointmentId,
    //   })
    //   .getOne();

    // if (!lockedAppointment) {
    //   throw new NotFoundException(
    //     'Appointment not found',
    //   );
    // }

    const appointmentRepository =
      manager.getRepository(appointment);

    const appointmentEntity =
      await appointmentRepository.findOne({
        where: {
          id: appointmentId,
        },
        relations: {
          patient: true,
          doctor: true,
          recurringAvailability: true,
        },
      });

    if (!appointmentEntity) {
      throw new NotFoundException(
        'Appointment not found',
      );
    }

    if (
      appointmentEntity.patient.id !==
      patientId
    ) {
      throw new ForbiddenException(
        'You can only reschedule your own appointment',
      );
    }

    if (
      appointmentEntity.status ===
      appointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cancelled appointment cannot be rescheduled',
      );
    }

    const currentTime =
      appointmentEntity.slotStartTime ??
      appointmentEntity.recurringAvailability
        .startTime;

    const appointmentDateTime = new Date(
      `${appointmentEntity.appointmentDate}T${currentTime}`,
    );

    const difference =
      appointmentDateTime.getTime() -
      Date.now();

    if (difference < 30 * 60 * 1000) {
      throw new BadRequestException(
        'Appointments cannot be rescheduled within 30 minutes',
      );
    }

    const { availability } =
      await this.resolveAvailability(
        appointmentEntity.doctor.id,
        dto.appointmentDate,
        manager,
      );

    if (
      availability.id !==
      dto.availabilityId
    ) {
      throw new BadRequestException(
        'Invalid availability selected',
      );
    }

    if (
      appointmentEntity
        .recurringAvailability.id ===
        dto.availabilityId &&
      appointmentEntity.appointmentDate ===
        dto.appointmentDate &&
      (appointmentEntity.slotStartTime ??
        null) ===
        (dto.slotStartTime ?? null)
    ) {
      throw new BadRequestException(
        'Appointment is already booked for the same slot',
      );
    }

    const bookingTime =
      availability.schedulingType ===
      SchedulingType.STREAM
        ? availability.startTime
        : dto.slotStartTime;

    const requestedDateTime = new Date(
      `${dto.appointmentDate}T${bookingTime}`,
    );

    if (
      requestedDateTime <= new Date()
    ) {
      throw new BadRequestException(
        'Appointment must be scheduled in the future',
      );
    }

        // ==========================
    // STREAM
    // ==========================
    if (
      availability.schedulingType ===
      SchedulingType.STREAM
    ) {


      await manager
  .createQueryBuilder(
    RecurringAvailability,
    'availability',
  )
  .setLock('pessimistic_write')
  .where('availability.id = :id', {
    id: availability.id,
  })
  .getOne();


      const booked = await manager.count(
        appointment,
        {
          where: {
            recurringAvailability: {
              id: availability.id,
            },
            appointmentDate:
              dto.appointmentDate,
            status:
              appointmentStatus.BOOKED,
          },
        },
      );

      if (
        booked >=
        (availability.capacity ?? 0)
      ) {
        const next =
  await this.findNextAvailableStream(
    appointmentEntity.doctor.id,
    dto.appointmentDate,
    manager,
  );

throw new BadRequestException({
  message: 'Stream is full',
  nextAvailable: next,
});
      }

      appointmentEntity.recurringAvailability =
        availability;
      appointmentEntity.appointmentDate =
        dto.appointmentDate;
      appointmentEntity.slotStartTime =
        null;
      appointmentEntity.slotEndTime =
        null;
      appointmentEntity.tokenNumber =
        booked + 1;

      return manager.save(
        appointmentEntity,
      );
    }

    // ==========================
    // WAVE
    // ==========================
    if (
      availability.schedulingType ===
      SchedulingType.WAVE
    ) {
      if (!dto.slotStartTime) {
        throw new BadRequestException(
          'slotStartTime is required',
        );
      }

      const slots =
        this.generateWaveSlots(
          availability.startTime,
          availability.endTime,
          availability.slotDuration!,
          availability.bufferTime ??
            0,
        );

      const selected = slots.find(
        (slot) =>
          slot.startTime ===
          dto.slotStartTime,
      );

      if (!selected) {
        throw new BadRequestException(
          'Invalid slot selected',
        );
      }

      const booked = await manager.count(
        appointment,
        {
          where: {
            recurringAvailability: {
              id: availability.id,
            },
            appointmentDate:
              dto.appointmentDate,
            slotStartTime:
              dto.slotStartTime,
            status:
              appointmentStatus.BOOKED,
          },
        },
      );

      if (
        booked >=
        (availability.capacity ?? 0)
      ) {
        const next =
  await this.findNextAvailableStream(
    appointmentEntity.doctor.id,
    dto.appointmentDate,
    manager,
  );

        throw new BadRequestException({
          message:
            'Selected slot is full',
          nextAvailable: next,
        });
      }

      appointmentEntity.recurringAvailability =
        availability;
      appointmentEntity.appointmentDate =
        dto.appointmentDate;
      appointmentEntity.slotStartTime =
        selected.startTime;
      appointmentEntity.slotEndTime =
        selected.endTime;
      appointmentEntity.tokenNumber =
        null;

      return manager.save(
        appointmentEntity,
      );
    }

    throw new BadRequestException(
      'Invalid scheduling type',
    );
  });
}

public async findNextAvailableStream(
  doctorId: number,
  appointmentDate: string,
  manager: EntityManager,
) {
  let date = new Date(appointmentDate);

  for (let i = 0; i < 30; i++) {
    const currentDate = date
      .toISOString()
      .split('T')[0];

    try {
      // Use the same Smart Date Resolution
      const { availability } =
        await this.resolveAvailability(
          doctorId,
          currentDate,
          manager,
        );

      if (
        availability.schedulingType !==
        SchedulingType.STREAM
      ) {
        date.setDate(date.getDate() + 1);
        continue;
      }

      const booked =
        await manager.count(appointment, {
          where: {
            recurringAvailability: {
              id: availability.id,
            },
            appointmentDate: currentDate,
            status:
              appointmentStatus.BOOKED,
          },
        });

      if (
        booked <
        (availability.capacity ?? 1)
      ) {
        return {
          availabilityId: availability.id,
          appointmentDate: currentDate,
          schedulingType:
            availability.schedulingType,
          startTime:
            availability.startTime,
          endTime:
            availability.endTime,
          availableSlots:
            (availability.capacity ??
              1) - booked,
        };
      }
    } catch {
      // Doctor unavailable on this date
    }

    date.setDate(date.getDate() + 1);
  }

  return null;
}

private async findAffectedAppointments(
  doctorId: number,
  availabilityId: number,
  effectiveDate: string,
  newStartTime: string,
  newEndTime: string,
  manager: EntityManager,
): Promise<appointment[]> {
  const appointmentRepository = manager.getRepository(appointment);

  const appointments = await appointmentRepository.find({
    where: {
      doctor: { id: doctorId },
      recurringAvailability: { id: availabilityId },
      status: appointmentStatus.BOOKED,
    },
    relations: {
      doctor: true,
      patient: true,
      recurringAvailability: true,
    },
    order: {
      appointmentDate: 'ASC',
      slotStartTime: 'ASC',
      createdAt: 'ASC',
    },
  });

  const affectedAppointments: appointment[] = [];

  for (const booking of appointments) {
    // Ignore appointments before the effective date
    if (booking.appointmentDate < effectiveDate) {
      continue;
    }

    const availability = booking.recurringAvailability;

    // STREAM scheduling
    if (availability.schedulingType === SchedulingType.STREAM) {
      if (
        availability.startTime < newStartTime ||
        availability.endTime > newEndTime
      ) {
        affectedAppointments.push(booking);
      }

      continue;
    }

    // WAVE scheduling
    const bookingStart =
  booking.slotStartTime?.slice(0, 5);

const bookingEnd =
  booking.slotEndTime?.slice(0, 5);

console.log({
  bookingStart,
  bookingEnd,
  newStartTime,
  newEndTime,
});

if (
  bookingStart! < newStartTime ||
  bookingEnd! > newEndTime
) {
  console.log(
    'Affected appointment:',
    booking.id,
  );

  affectedAppointments.push(booking);
}
  }

  return affectedAppointments;
}


private async findNextAvailableAppointmentSlot(
  doctorId: number,
  startSearchingFrom: string,
  manager: EntityManager,
): Promise<{
  availability: RecurringAvailability;
  appointmentDate: string;
  slotStartTime: string | null;
  slotEndTime: string | null;
} | null> {

  let currentDate = new Date(startSearchingFrom);

  // Search next 30 doctor working days
  for (let searched = 0; searched < 3; searched++) {

    const date = currentDate.toISOString().split('T')[0];

    try {

      // Uses your existing logic
      const { availability } =
        await this.resolveAvailability(
          doctorId,
          date,
          manager,
        );

      // ==========================
      // STREAM
      // ==========================

      if (
        availability.schedulingType ===
        SchedulingType.STREAM
      ) {

        const booked =
          await manager.count(appointment, {
            where: {
              recurringAvailability: {
                id: availability.id,
              },
              appointmentDate: date,
              status: appointmentStatus.BOOKED,
            },
          });

        if (booked < (availability.capacity ?? 1)) {

          return {
            availability,
            appointmentDate: date,
            slotStartTime: null,
            slotEndTime: null,
          };
        }
      }

      // ==========================
      // WAVE
      // ==========================

      const slots = this.generateWaveSlots(
        availability.startTime,
        availability.endTime,
        availability.slotDuration!,
        availability.bufferTime ?? 0,
      );

      for (const slot of slots) {

        const booked =
          await manager.count(appointment, {
            where: {
              recurringAvailability: {
                id: availability.id,
              },
              appointmentDate: date,
              slotStartTime: slot.startTime,
              status: appointmentStatus.BOOKED,
            },
          });

        if (booked < (availability.capacity ?? 1)) {

          return {
            availability,
            appointmentDate: date,
            slotStartTime: slot.startTime,
            slotEndTime: slot.endTime,
          };
        }
      }

    } catch {
      // Doctor unavailable on this date.
      // Continue searching.
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return null;
}

private async autoRescheduleAppointment(
  appointmentEntity: appointment,
  manager: EntityManager,
): Promise<appointment> {

  const nextSlot =
    await this.findNextAvailableAppointmentSlot(
      appointmentEntity.doctor.id,
      appointmentEntity.appointmentDate,
      manager,
    );

  if (!nextSlot) {
    throw new BadRequestException(
      `No available slot found for Appointment #${appointmentEntity.id}`,
    );
  }

  // Save previous slot details
  appointmentEntity.previousSlotId =
    appointmentEntity.slotId;

  appointmentEntity.previousSlotStartTime =
    appointmentEntity.slotStartTime;

  appointmentEntity.previousSlotEndTime =
    appointmentEntity.slotEndTime;

  // Move appointment
  appointmentEntity.recurringAvailability =
    nextSlot.availability;

  appointmentEntity.appointmentDate =
    nextSlot.appointmentDate;

  appointmentEntity.slotStartTime =
    nextSlot.slotStartTime;

  appointmentEntity.slotEndTime =
    nextSlot.slotEndTime;

  appointmentEntity.rescheduledAutomatically = true;

  appointmentEntity.rescheduledAt = new Date();

  appointmentEntity.rescheduleReason =
    'DOCTOR_SHRUNK_AVAILABILITY';

  appointmentEntity.status =
    appointmentStatus.BOOKED;

  return manager.save(appointmentEntity);
}

}