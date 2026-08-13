import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Patient } from '../patient/patient.entity';
import { EmailService } from '../email/email.service';

import {
  DataSource,
  EntityManager,
  Repository,
  In,
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

import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification-type.enum';

@Injectable()
export class ElasticSchedulingService {
  constructor(
  @InjectRepository(appointment)
  private readonly appointmentRepository: Repository<appointment>,

  @InjectRepository(RecurringAvailability)
  private readonly recurringAvailabilityRepository:
    Repository<RecurringAvailability>,

  @InjectRepository(CustomAvailability)
  private readonly customAvailabilityRepository:
    Repository<CustomAvailability>,

  @InjectRepository(Doctor)
  private readonly doctorRepository:
    Repository<Doctor>,

  private readonly dataSource: DataSource,

  private readonly notificationService:
    NotificationService,

    private readonly emailService:
  EmailService,
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

// public async findAffectedAppointments(
//   doctorId: number,
//   availabilityId: number,
//   effectiveDate: string,
//   newStartTime: string,
//   newEndTime: string,
//   manager: EntityManager,
// ): Promise<appointment[]> {

//   const appointmentRepository =
//     manager.getRepository(appointment);

//   const appointments =
//     await appointmentRepository.find({
//       where: {
//         doctor: {
//           id: doctorId,
//         },
//         recurringAvailability: {
//           id: availabilityId,
//         },
//         status: appointmentStatus.BOOKED,
//       },
//       relations: {
//         doctor: true,
//         patient: true,
//         recurringAvailability: true,
//       },
//       order: {
//         appointmentDate: 'ASC',
//         createdAt: 'ASC',
//       },
//     });

//   const affectedAppointments: appointment[] = [];

//   for (const booking of appointments) {

//     // Ignore appointments before the effective date
//     if (booking.appointmentDate < effectiveDate) {
//       continue;
//     }

//     const availability =
//       booking.recurringAvailability;

//     // ==========================
//     // STREAM Scheduling
//     // ==========================

//     if (
//       availability.schedulingType ===
//       SchedulingType.STREAM
//     ) {

//       // Any stream appointment becomes invalid
//       // if the availability window shrinks.
//       affectedAppointments.push(booking);
//       continue;

//     }

//     // ==========================
//     // WAVE Scheduling
//     // ==========================

//     const bookingStart =
//       booking.slotStartTime?.substring(0, 5);

//     const bookingEnd =
//       booking.slotEndTime?.substring(0, 5);

//     console.log({
//       appointmentId: booking.id,
//       bookingStart,
//       bookingEnd,
//       newStartTime,
//       newEndTime,
//     });

//     // Reschedule ONLY appointments outside the new window
//     const startsBeforeWindow =
//       bookingStart! < newStartTime;

//     const endsAfterWindow =
//       bookingEnd! > newEndTime;

//     if (
//       startsBeforeWindow ||
//       endsAfterWindow
//     ) {

//       console.log(
//         'Affected appointment:',
//         booking.id,
//       );

//       affectedAppointments.push(booking);

//     }

//   }

//   return affectedAppointments;
// }

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
        status: In([
          appointmentStatus.BOOKED,
          appointmentStatus.RESCHEDULED,
        ]),
      },
      relations: {
        doctor: true,
        patient: true,
        recurringAvailability: true,
      },
      order: {
        appointmentDate: 'ASC',
        slotStartTime: 'ASC',
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

      // Any booked appointment may become invalid
      // when the stream window shrinks.
      affectedAppointments.push(booking);
      continue;

    }

    // ==========================
    // WAVE Scheduling
    // ==========================

    const bookingStart =
      booking.slotStartTime?.substring(0, 5);

    const bookingEnd =
      booking.slotEndTime?.substring(0, 5);

    console.log({
      appointmentId: booking.id,
      bookingStart,
      bookingEnd,
      newStartTime,
      newEndTime,
    });

    // Keep appointments completely inside the new window
    const isInsideNewWindow =
      bookingStart! >= newStartTime &&
      bookingEnd! <= newEndTime;

    if (isInsideNewWindow) {

      console.log(
        'Keeping appointment:',
        booking.id,
      );

      continue;

    }

    console.log(
      'Affected appointment:',
      booking.id,
    );

    affectedAppointments.push(booking);

  }

  return affectedAppointments;
}


public async findNextAvailableAppointmentSlot(
  doctorId: number,
  originalAppointmentDate: string,
  originalSlotStartTime: string | null,
  manager: EntityManager,
  reservedSlots: Set<string>,

): Promise<{
  availability: RecurringAvailability;
  appointmentDate: string;
  slotStartTime: string | null;
  slotEndTime: string | null;
} | null> {

  let currentDate = new Date(originalAppointmentDate);

let recurringDaysChecked = 0;

while (recurringDaysChecked < 2) {

    const searchDate = currentDate
      .toISOString()
      .split('T')[0];

    const dayOfWeek = new Date(searchDate)
      .toLocaleDateString('en-US', {
        weekday: 'long',
      })
      .toUpperCase();

    const availabilities =
      await manager
        .getRepository(RecurringAvailability)
        .find({
          where: {
            doctor: {
              id: doctorId,
            },
            day: dayOfWeek as any,
          },
          relations: {
            doctor: true,
          },
          order: {
            startTime: 'ASC',
          },
        });

    // Doctor unavailable on this day
    if (!availabilities.length) {

    currentDate.setDate(
      currentDate.getDate() + 1,
    );

    continue;
}

    // Check every availability window
    for (const availability of availabilities) {

      console.log(
        'Checking availability:',
        availability.day,
        availability.startTime,
        availability.endTime,
      );

      // ===========================
      // STREAM Scheduling
      // ===========================

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
      appointmentDate: searchDate,
      status: In([
        appointmentStatus.BOOKED,
        appointmentStatus.RESCHEDULED,
      ]),
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

  if (
    searchDate === originalAppointmentDate &&
    originalSlotStartTime &&
    slot.startTime <= originalSlotStartTime
  ) {
    continue;
  }

  // NEW
  const slotKey =
    `${searchDate}_${slot.startTime}`;

  if (reservedSlots.has(slotKey)) {
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
        status: In([
          appointmentStatus.BOOKED,
          appointmentStatus.RESCHEDULED,
        ]),
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

    }

    recurringDaysChecked++;

    // Move to next calendar day
    currentDate.setDate(
      currentDate.getDate() + 1,
    );

  }

  return null;
}

public async autoRescheduleAppointment(
  appointmentEntity: appointment,
  manager: EntityManager,
  reservedSlots: Set<string>,
): Promise<appointment> {

  const nextSlot =
    await this.findNextAvailableAppointmentSlot(
      appointmentEntity.doctor.id,
      appointmentEntity.appointmentDate,
      appointmentEntity.slotStartTime,
      manager,
      reservedSlots,
    );

  // =====================================
  // NO AVAILABLE SLOT
  // AUTOMATICALLY CANCEL APPOINTMENT
  // =====================================

  if (!nextSlot) {

    const previousTime =
      appointmentEntity.slotStartTime ??
      appointmentEntity
        .recurringAvailability
        .startTime;

    // Preserve previous slot details
    appointmentEntity.previousSlotId =
      appointmentEntity.slotId;

    appointmentEntity.previousSlotStartTime =
      appointmentEntity.slotStartTime;

    appointmentEntity.previousSlotEndTime =
      appointmentEntity.slotEndTime;

    // Cancel appointment
    appointmentEntity.status =
      appointmentStatus.CANCELLED;

    appointmentEntity.rescheduledAutomatically =
      true;

    appointmentEntity.rescheduledAt =
      new Date();

    appointmentEntity.rescheduleReason =
      'NO_AVAILABLE_SLOT_FOUND';

    const cancelledAppointment =
      await manager.save(
        appointmentEntity,
      );

    // =====================================
    // EXISTING DATABASE NOTIFICATION
    // =====================================

    await this.notificationService
      .createAppointmentNotification(
        {
          patientId:
            cancelledAppointment.patient.id,

          appointmentId:
            cancelledAppointment.id,

          type:
            NotificationType.APPOINTMENT_CANCELLED,

          eventId:
            `AUTO_CANCELLATION_${cancelledAppointment.id}_${cancelledAppointment.appointmentDate}_${previousTime}`,

          title:
            'Appointment Cancelled',

          message:
            `Your appointment scheduled on ${cancelledAppointment.appointmentDate} at ${previousTime} has been cancelled because no alternative slot was available after the doctor's availability changed.`,
        },

        manager,
      );

    // =====================================
    // AUTOMATIC CANCELLATION EMAIL
    // =====================================

    try {

      const patient =
        await manager.findOne(
          Patient,
          {
            where: {
              id:
                cancelledAppointment
                  .patient.id,
            },

            relations: {
              user: true,
            },
          },
        );

      if (
        patient?.user?.email
      ) {

        await this.emailService.sendEmail(
          patient.user.email,

          'Appointment Automatically Cancelled',

          `
            <div
              style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                padding: 20px;
              "
            >

              <h2>
                Appointment Automatically Cancelled
              </h2>

              <p>
                Hello
                ${patient.user.name ?? 'Patient'},
              </p>

              <p>
                Unfortunately, your appointment
                has been automatically cancelled
                because no alternative appointment
                slot was available after the
                doctor's availability changed.
              </p>

              <p>
                <strong>Doctor:</strong>
                ${cancelledAppointment.doctor.fullName}
              </p>

              <p>
                <strong>Date:</strong>
                ${cancelledAppointment.appointmentDate}
              </p>

              <p>
                <strong>Previous Time:</strong>
                ${previousTime}
              </p>

              <p>
                <strong>Appointment ID:</strong>
                #${cancelledAppointment.id}
              </p>

              <p>
                Please book another available
                appointment slot.
              </p>

            </div>
          `,
        );

        console.log(
          `Automatic cancellation email sent for Appointment #${cancelledAppointment.id} to ${patient.user.email}`,
        );

      } else {

        console.warn(
          `Appointment #${cancelledAppointment.id} was automatically cancelled, but patient email was not found.`,
        );

      }

    } catch (error) {

      console.error(
        `Appointment #${cancelledAppointment.id} was automatically cancelled, but email notification failed:`,
        error,
      );

    }

    return cancelledAppointment;
  }

  // =====================================
  // REPLACEMENT SLOT FOUND
  // AUTOMATIC RESCHEDULE
  // =====================================

  // Preserve previous appointment details
  appointmentEntity.previousSlotId =
    appointmentEntity.slotId;

  appointmentEntity.previousSlotStartTime =
    appointmentEntity.slotStartTime;

  appointmentEntity.previousSlotEndTime =
    appointmentEntity.slotEndTime;

  // Reserve the selected slot
  if (nextSlot.slotStartTime) {

    reservedSlots.add(
      `${nextSlot.appointmentDate}_${nextSlot.slotStartTime}`,
    );

  }

  // Update appointment
  appointmentEntity.recurringAvailability =
    nextSlot.availability;

  appointmentEntity.appointmentDate =
    nextSlot.appointmentDate;

  appointmentEntity.slotStartTime =
    nextSlot.slotStartTime;

  appointmentEntity.slotEndTime =
    nextSlot.slotEndTime;

  appointmentEntity.status =
    appointmentStatus.RESCHEDULED;

  appointmentEntity.rescheduledAutomatically =
    true;

  appointmentEntity.rescheduledAt =
    new Date();

  appointmentEntity.rescheduleReason =
    'DOCTOR_SHRUNK_AVAILABILITY';

  const savedAppointment =
    await manager.save(
      appointmentEntity,
    );

  // =====================================
  // EXISTING DATABASE NOTIFICATION
  // =====================================

  const newTime =
    savedAppointment.slotStartTime ??
    savedAppointment
      .recurringAvailability
      .startTime;

  await this.notificationService
    .createAppointmentNotification(
      {
        patientId:
          savedAppointment.patient.id,

        appointmentId:
          savedAppointment.id,

        type:
          NotificationType.APPOINTMENT_RESCHEDULED,

        eventId:
          `AUTO_RESCHEDULE_${savedAppointment.id}_${savedAppointment.appointmentDate}_${newTime}`,

        title:
          'Appointment Rescheduled',

        message:
          `Your appointment has been automatically rescheduled to ${savedAppointment.appointmentDate} at ${newTime} because of a change in the doctor's availability.`,
      },

      manager,
    );

  // =====================================
  // AUTOMATIC RESCHEDULE EMAIL
  // =====================================

  try {

    const patient =
      await manager.findOne(
        Patient,
        {
          where: {
            id:
              savedAppointment
                .patient.id,
          },

          relations: {
            user: true,
          },
        },
      );

    if (
      patient?.user?.email
    ) {

      await this.emailService.sendEmail(
        patient.user.email,

        'Appointment Automatically Rescheduled',

        `
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: auto;
              padding: 20px;
            "
          >

            <h2>
              Appointment Automatically Rescheduled
            </h2>

            <p>
              Hello
              ${patient.user.name ?? 'Patient'},
            </p>

            <p>
              Your appointment has been
              automatically rescheduled because
              of a change in the doctor's
              availability.
            </p>

            <p>
              <strong>Doctor:</strong>
              ${savedAppointment.doctor.fullName}
            </p>

            <p>
              <strong>New Date:</strong>
              ${savedAppointment.appointmentDate}
            </p>

            <p>
              <strong>New Time:</strong>
              ${newTime}
            </p>

            <p>
              <strong>Appointment ID:</strong>
              #${savedAppointment.id}
            </p>

            <p>
              Please note your new appointment time.
            </p>

          </div>
        `,
      );

      console.log(
        `Automatic reschedule email sent for Appointment #${savedAppointment.id} to ${patient.user.email}`,
      );

    } else {

      console.warn(
        `Appointment #${savedAppointment.id} was automatically rescheduled, but patient email was not found.`,
      );

    }

  } catch (error) {

    console.error(
      `Appointment #${savedAppointment.id} was automatically rescheduled, but email notification failed:`,
      error,
    );

  }

  return savedAppointment;
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
  const reservedSlots = new Set<string>();

for (const booking of affectedAppointments) {

  await this.autoRescheduleAppointment(
    booking,
    manager,
    reservedSlots,
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