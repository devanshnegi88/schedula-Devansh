import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  DataSource,
  EntityManager,
  Repository,
} from 'typeorm';

import {
  appointment,
  appointmentStatus,
} from './appointment.entity';

import {
  RecurringAvailability,
  SchedulingType,
} from '../recurring-availability/entities/recurring-availability.entity';

import { CustomAvailability } from '../custom-availability/entities/custom-availability.entity';

import { Doctor } from '../doctor/doctor.entity';

import { Day } from '../enums/day.enum';

@Injectable()
export class ElasticSchedulingService {
  constructor(
    @InjectRepository(appointment)
    private readonly appointmentRepository: Repository<appointment>,

    @InjectRepository(RecurringAvailability)
    private readonly recurringAvailabilityRepository: Repository<RecurringAvailability>,

    @InjectRepository(CustomAvailability)
    private readonly customAvailabilityRepository: Repository<CustomAvailability>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,

    private readonly dataSource: DataSource,
  ) {}



  public async resolveAvailability(
  doctorId: number,
  date: string,
  manager?: EntityManager,
) {
  if (isNaN(new Date(date).getTime())) {
    throw new BadRequestException('Invalid date');
  }

  const customRepo = manager
    ? manager.getRepository(CustomAvailability)
    : this.customAvailabilityRepository;

  const recurringRepo = manager
    ? manager.getRepository(RecurringAvailability)
    : this.recurringAvailabilityRepository;

  const customAvailability = await customRepo.findOne({
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

  let availability: RecurringAvailability | null = null;

  const days = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];

  const day = days[new Date(date).getUTCDay()] as Day;

  if (customAvailability) {
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

    availability = {
      ...recurringAvailability,
      startTime: customAvailability.startTime,
      endTime: customAvailability.endTime,
    };
  } else {
    availability = await recurringRepo.findOne({
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

    if (!availability) {
      throw new NotFoundException(
        'Doctor is not available on this date',
      );
    }
  }

  return {
    source: customAvailability ? 'CUSTOM' : 'RECURRING',
    availability,
  };
}

public generateWaveSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
  bufferTime: number,
) {
  const slots: {
    startTime: string;
    endTime: string;
  }[] = [];

  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);

  let current = new Date(start);

  while (true) {
    const slotEnd = new Date(current);

    slotEnd.setMinutes(
      slotEnd.getMinutes() + slotDuration,
    );

    if (slotEnd > end) {
      break;
    }

    slots.push({
      startTime: current.toTimeString().slice(0, 5),
      endTime: slotEnd.toTimeString().slice(0, 5),
    });

    current = new Date(
      slotEnd.getTime() +
      bufferTime * 60000,
    );
  }

  return slots;
}

public async findAffectedAppointments(
  doctorId: number,
  availabilityId: number,
  effectiveDate: string,
  newStartTime: string,
  newEndTime: string,
  manager: EntityManager,
): Promise<appointment[]> {

  const appointmentRepository =
    manager.getRepository(appointment);

  const appointments =
    await appointmentRepository.find({
      where: {
        doctor: {
          id: doctorId,
        },
        recurringAvailability: {
          id: availabilityId,
        },
        status: appointmentStatus.BOOKED,
      },
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

  const affectedAppointments: appointment[] = [];

  for (const booking of appointments) {

    // Ignore appointments before the effective date
    if (booking.appointmentDate < effectiveDate) {
      continue;
    }

    const availability =
      booking.recurringAvailability;

    // ==========================
    // STREAM Scheduling
    // ==========================

    if (
      availability.schedulingType ===
      SchedulingType.STREAM
    ) {

      // Entire stream becomes invalid if the
      // availability window changes.

      if (
        availability.startTime !== newStartTime ||
        availability.endTime !== newEndTime
      ) {
        affectedAppointments.push(booking);
      }

      continue;
    }

    // ==========================
    // WAVE Scheduling
    // ==========================

    if (
      booking.slotStartTime! < newStartTime ||
      booking.slotEndTime! > newEndTime
    ) {
      affectedAppointments.push(booking);
    }
  }

  return affectedAppointments;
}

public async findNextAvailableAppointmentSlot(
  doctorId: number,
  originalAppointmentDate: string,
  originalSlotStartTime: string | null,
  manager: EntityManager,
): Promise<{
  availability: RecurringAvailability;
  appointmentDate: string;
  slotStartTime: string | null;
  slotEndTime: string | null;
} | null> {

  let currentDate = new Date(originalAppointmentDate);

  // Search next 30 available dates
  for (let day = 0; day < 30; day++) {

    const searchDate = currentDate
      .toISOString()
      .split('T')[0];

    try {

      const { availability } =
        await this.resolveAvailability(
          doctorId,
          searchDate,
          manager,
        );

        console.log(
  'Found availability:',
  availability.day,
  availability.startTime,
  availability.endTime,
);

      // ===========================
      // STREAM Scheduling
      // ===========================

      // ===========================
// STREAM Scheduling
// ===========================

if (
  availability.schedulingType ===
  SchedulingType.STREAM
) {

  const booked =
    await manager
      .getRepository(appointment)
      .count({
        where: {
          recurringAvailability: {
            id: availability.id,
          },
          appointmentDate: searchDate,
          status: appointmentStatus.BOOKED,
        },
      });

  if (
    booked < (availability.capacity ?? 1)
  ) {

    return {
      availability,
      appointmentDate: searchDate,
      slotStartTime: null,
      slotEndTime: null,
    };

  }

  currentDate.setDate(currentDate.getDate() + 1);
continue;
}

      // ===========================
      // WAVE Scheduling
      // ===========================

      const slots =
        this.generateWaveSlots(
          availability.startTime,
          availability.endTime,
          availability.slotDuration!,
          availability.bufferTime ?? 0,
        );

      for (const slot of slots) {

        // Don't move backwards on the same day
        if (
          searchDate === originalAppointmentDate &&
          originalSlotStartTime &&
          slot.startTime <= originalSlotStartTime
        ) {
          continue;
        }

        const booked =
          await manager.count(appointment, {
            where: {
              recurringAvailability: {
                id: availability.id,
              },
              appointmentDate: searchDate,
              slotStartTime: slot.startTime,
              status: appointmentStatus.BOOKED,
            },
          });

        if (
          booked < (availability.capacity ?? 1)
        ) {

          return {
            availability,
            appointmentDate: searchDate,
            slotStartTime: slot.startTime,
            slotEndTime: slot.endTime,
          };

        }

      }

    } catch {

      // Doctor unavailable
      // Continue searching

    }

    currentDate.setDate(
      currentDate.getDate() + 1,
    );

  }

  return null;
}

public async autoRescheduleAppointment(
  appointmentEntity: appointment,
  manager: EntityManager,
): Promise<appointment> {

  const nextSlot =
    await this.findNextAvailableAppointmentSlot(
      appointmentEntity.doctor.id,
      appointmentEntity.appointmentDate,
      appointmentEntity.slotStartTime,
      manager,
    );

  if (!nextSlot) {
    throw new BadRequestException(
      `Unable to automatically reschedule appointment #${appointmentEntity.id}. No available slot found.`,
    );
  }

  // =====================================
  // Preserve previous appointment details
  // =====================================

  appointmentEntity.previousSlotId =
    appointmentEntity.slotId;

  appointmentEntity.previousSlotStartTime =
    appointmentEntity.slotStartTime;

  appointmentEntity.previousSlotEndTime =
    appointmentEntity.slotEndTime;

  // =====================================
  // Update appointment
  // =====================================

  appointmentEntity.recurringAvailability =
    nextSlot.availability;

  appointmentEntity.appointmentDate =
    nextSlot.appointmentDate;

  appointmentEntity.slotStartTime =
    nextSlot.slotStartTime;

  appointmentEntity.slotEndTime =
    nextSlot.slotEndTime;

  appointmentEntity.rescheduledAutomatically =
    true;

  appointmentEntity.rescheduledAt =
    new Date();

  appointmentEntity.rescheduleReason =
    'DOCTOR_SHRUNK_AVAILABILITY';

  appointmentEntity.status =
    appointmentStatus.BOOKED;

  return await manager.save(appointmentEntity);
}

public async handleAvailabilityShrink(
  availability: RecurringAvailability,
  newStartTime: string,
  newEndTime: string,
  effectiveDate: string,
  manager: EntityManager,
): Promise<void> {

  // Step 1: Find affected appointments
  const affectedAppointments =
    await this.findAffectedAppointments(
      availability.doctor.id,
      availability.id,
      effectiveDate,
      newStartTime,
      newEndTime,
      manager,
    );

  if (!affectedAppointments.length) {
    return;
  }

  // Step 2: Sort appointments
  affectedAppointments.sort((a, b) => {

    if (a.appointmentDate !== b.appointmentDate) {
      return a.appointmentDate.localeCompare(
        b.appointmentDate,
      );
    }

    return (a.slotStartTime ?? '').localeCompare(
      b.slotStartTime ?? '',
    );

  });

  // Step 3: Reschedule one by one
  for (const booking of affectedAppointments) {

    await this.autoRescheduleAppointment(
      booking,
      manager,
    );

  }

}

public async handleAvailabilityExpand(
  availability: RecurringAvailability,
  oldStartTime: string,
  oldEndTime: string,
  manager: EntityManager,
): Promise<void> {

  // Expand currently requires no appointment migration.

  // Existing appointments remain valid.

  // Patients can immediately book the newly available
  // time because your booking system dynamically generates
  // slots using generateWaveSlots().

  return;
}
}