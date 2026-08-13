// import {
//   Injectable,
//   Logger,
// } from '@nestjs/common';

// import { Cron, CronExpression } from '@nestjs/schedule';
// import { EmailService } from '../email/email.service';

// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository, In } from 'typeorm';

// import {
//   appointment,
//   appointmentStatus,
// } from '../appointment/appointment.entity';

// import {
//   SchedulingType,
// } from '../recurring-availability/entities/recurring-availability.entity';

// import { NotificationService } from '../notification/notification.service';
// import { NotificationType } from '../notification/notification-type.enum';

// @Injectable()
// export class AppointmentReminderService {
//   private readonly logger = new Logger(
//     AppointmentReminderService.name,
//   );

//   /**
//    * Reminder is generated approximately
//    * 30 minutes before the appointment.
//    *
//    * Cron runs every minute, therefore we use
//    * a 29-31 minute window.
//    */
//   private readonly REMINDER_MINUTES = 2;
//   private readonly REMINDER_WINDOW_MINUTES = 1;

//   constructor(
//     @InjectRepository(appointment)
//     private readonly appointmentRepository: Repository<appointment>,

//     private readonly notificationService: NotificationService,
//     private readonly emailService: EmailService,
//   ) {}

//   // ============================================================
//   // CRON JOB
//   // ============================================================

//   @Cron(CronExpression.EVERY_MINUTE)
//   async generateAppointmentReminders(): Promise<void> {
//     this.logger.log(
//       'Running appointment reminder cron job...',
//     );

//     try {
//       const appointments =
//         await this.findUpcomingAppointments();

//       this.logger.log(
//         `Found ${appointments.length} appointment(s) in reminder window.`,
//       );

//       for (const appointmentEntity of appointments) {
//         await this.processAppointment(
//           appointmentEntity,
//         );
//       }
//     } catch (error) {
//       this.logger.error(
//         'Appointment reminder cron job failed',
//         error instanceof Error
//           ? error.stack
//           : error,
//       );
//     }
//   }

//   // ============================================================
//   // FIND UPCOMING APPOINTMENTS
//   // ============================================================

//   private async findUpcomingAppointments(): Promise<
//     appointment[]
//   > {
//     const now = new Date();

//     const reminderFrom = new Date(
//       now.getTime() +
//         (this.REMINDER_MINUTES -
//           this.REMINDER_WINDOW_MINUTES) *
//           60 *
//           1000,
//     );

//     const reminderTo = new Date(
//       now.getTime() +
//         (this.REMINDER_MINUTES +
//           this.REMINDER_WINDOW_MINUTES) *
//           60 *
//           1000,
//     );

//     /*
//      * appointmentDate is a PostgreSQL DATE column,
//      * not a timestamp.
//      *
//      * Therefore we first fetch today's and tomorrow's
//      * active appointments and calculate the actual
//      * appointment datetime in TypeScript.
//      */
//     const today =
//       this.formatDateForDatabase(now);

//     const tomorrowDate =
//       new Date(now);

//     tomorrowDate.setDate(
//       tomorrowDate.getDate() + 1,
//     );

//     const tomorrow =
//       this.formatDateForDatabase(
//         tomorrowDate,
//       );

//     const appointments =
//       await this.appointmentRepository.find({
//         where: {
//           appointmentDate: In([
//             today,
//             tomorrow,
//           ]),

//           status: In([
//             appointmentStatus.BOOKED,
//             appointmentStatus.RESCHEDULED,
//           ]),
//         },

//         relations: {
//           doctor: true,
//           patient: {
//             user: true,
//           },
//           recurringAvailability: true,
//         },

//         order: {
//           appointmentDate: 'ASC',
//           createdAt: 'ASC',
//         },
//       });

//     return appointments.filter(
//       (appointmentEntity) => {
//         const appointmentDateTime =
//           this.getAppointmentDateTime(
//             appointmentEntity,
//           );

//         if (!appointmentDateTime) {
//           return false;
//         }

//         return (
//           appointmentDateTime >=
//             reminderFrom &&
//           appointmentDateTime <
//             reminderTo
//         );
//       },
//     );
//   }

//   // ============================================================
//   // PROCESS APPOINTMENT
//   // ============================================================

// private async processAppointment(
//   appointmentEntity: appointment,
// ): Promise<void> {
//   if (!appointmentEntity.id) {
//     this.logger.warn(
//       'Skipping appointment with invalid ID.',
//     );

//     return;
//   }

//   if (
//     appointmentEntity.status ===
//     appointmentStatus.CANCELLED
//   ) {
//     return;
//   }

//   if (!appointmentEntity.doctor) {
//     this.logger.warn(
//       `Skipping appointment #${appointmentEntity.id}: doctor not found.`,
//     );

//     return;
//   }

//   if (!appointmentEntity.patient) {
//     this.logger.warn(
//       `Skipping appointment #${appointmentEntity.id}: patient not found.`,
//     );

//     return;
//   }

//   if (!appointmentEntity.patient.user?.email) {
//     this.logger.warn(
//       `Skipping appointment #${appointmentEntity.id}: patient email not found.`,
//     );

//     return;
//   }

//   if (
//     !appointmentEntity.recurringAvailability
//   ) {
//     this.logger.warn(
//       `Skipping appointment #${appointmentEntity.id}: recurring availability not found.`,
//     );

//     return;
//   }

//   const message =
//     this.buildReminderMessage(
//       appointmentEntity,
//     );

//   if (!message) {
//     this.logger.warn(
//       `Skipping appointment #${appointmentEntity.id}: incomplete reminder data.`,
//     );

//     return;
//   }

//   /*
//    * One reminder event per appointment.
//    */
//   const eventId =
//     `APPOINTMENT_REMINDER_${appointmentEntity.id}`;

//   /*
//    * Create in-app notification.
//    *
//    * Existing NotificationService already prevents
//    * duplicate notifications using appointmentId + eventId.
//    */
//   const notification =
//     await this.notificationService
//       .createAppointmentNotification({
//         patientId:
//           appointmentEntity.patient.id,

//         appointmentId:
//           appointmentEntity.id,

//         type:
//           NotificationType.APPOINTMENT_REMINDER,

//         eventId,

//         title:
//           'Appointment Reminder',

//         message,
//       });

//   /*
//    * Send reminder email.
//    *
//    * Email failure must NOT break the Cron job
//    * or notification creation.
//    */
//   try {
//     const schedulingType =
//       appointmentEntity
//         .recurringAvailability
//         .schedulingType;

//     const appointmentTime =
//       this.getAppointmentTime(
//         appointmentEntity,
//       );

//     await this.emailService.sendEmail(
//       appointmentEntity.patient.user.email,

//       'Appointment Reminder',

//       this.buildReminderEmail(
//         appointmentEntity,
//         schedulingType,
//         appointmentTime,
//       ),
//     );

//     this.logger.log(
//       `Reminder email sent to ${appointmentEntity.patient.user.email} for appointment #${appointmentEntity.id}`,
//     );
//   } catch (error) {
//     this.logger.error(
//       `Reminder notification was created for appointment #${appointmentEntity.id}, but email sending failed.`,
//       error instanceof Error
//         ? error.stack
//         : error,
//     );
//   }

//   this.logger.log(
//     `Appointment reminder processed for #${appointmentEntity.id}. Notification #${notification.id}`,
//   );
// }

//   // ============================================================
//   // BUILD REMINDER MESSAGE
//   // ============================================================

//   private buildReminderMessage(
//     appointmentEntity: appointment,
//   ): string | null {
//     const schedulingType =
//       appointmentEntity
//         .recurringAvailability
//         ?.schedulingType;

//     if (
//       schedulingType ===
//       SchedulingType.STREAM
//     ) {
//       return this.buildStreamReminder(
//         appointmentEntity,
//       );
//     }

//     if (
//       schedulingType ===
//       SchedulingType.WAVE
//     ) {
//       return this.buildWaveReminder(
//         appointmentEntity,
//       );
//     }

//     this.logger.warn(
//       `Unknown scheduling type for appointment #${appointmentEntity.id}`,
//     );

//     return null;
//   }

//   // ============================================================
//   // STREAM REMINDER
//   // ============================================================

//   private buildStreamReminder(
//     appointmentEntity: appointment,
//   ): string | null {
//     const doctorName =
//       appointmentEntity.doctor?.fullName;

//     const appointmentDate =
//       appointmentEntity.appointmentDate;

//     const appointmentTime =
//       appointmentEntity
//         .recurringAvailability
//         ?.startTime;

//     if (
//       !doctorName ||
//       !appointmentDate ||
//       !appointmentTime
//     ) {
//       return null;
//     }

//     return (
//       `Reminder: You have an appointment with ` +
//       `Dr. ${doctorName} today.\n\n` +
//       `Appointment Date: ${appointmentDate}\n` +
//       `Appointment Time: ${this.formatTime(
//         appointmentTime,
//       )}`
//     );
//   }

//   // ============================================================
//   // WAVE REMINDER
//   // ============================================================

//   private buildWaveReminder(
//   appointmentEntity: appointment,
// ): string | null {
//   const doctorName =
//     appointmentEntity.doctor?.fullName;

//   const reportingTime =
//     appointmentEntity.slotStartTime;

//   if (
//     !doctorName ||
//     !reportingTime
//   ) {
//     return null;
//   }

//   return (
//     `Reminder: You have an appointment with ` +
//     `Dr. ${doctorName} today.\n\n` +
//     `Reporting Time: ${this.formatTime(
//       reportingTime,
//     )}`
//   );
// }

//   // ============================================================
//   // GET ACTUAL APPOINTMENT DATETIME
//   // ============================================================

//   private getAppointmentDateTime(
//     appointmentEntity: appointment,
//   ): Date | null {
//     if (
//       !appointmentEntity.appointmentDate
//     ) {
//       return null;
//     }

//     const schedulingType =
//       appointmentEntity
//         .recurringAvailability
//         ?.schedulingType;

//     let time: string | null = null;

//     /*
//      * STREAM:
//      * appointment time comes from availability.startTime
//      */
//     if (
//       schedulingType ===
//       SchedulingType.STREAM
//     ) {
//       time =
//         appointmentEntity
//           .recurringAvailability
//           ?.startTime ?? null;
//     }

//     /*
//      * WAVE:
//      * appointment time comes from slotStartTime
//      */
//     if (
//       schedulingType ===
//       SchedulingType.WAVE
//     ) {
//       time =
//         appointmentEntity
//           .slotStartTime ?? null;
//     }

//     if (!time) {
//       return null;
//     }

//     const appointmentDateTime =
//       new Date(
//         `${appointmentEntity.appointmentDate}T${time}`,
//       );

//     if (
//       Number.isNaN(
//         appointmentDateTime.getTime(),
//       )
//     ) {
//       return null;
//     }

//     return appointmentDateTime;
//   }

//   // ============================================================
//   // FORMAT DATE
//   // ============================================================

//   private formatDateForDatabase(
//     date: Date,
//   ): string {
//     const year =
//       date.getFullYear();

//     const month =
//       String(
//         date.getMonth() + 1,
//       ).padStart(2, '0');

//     const day =
//       String(
//         date.getDate(),
//       ).padStart(2, '0');

//     return `${year}-${month}-${day}`;
//   }

//   // ============================================================
//   // FORMAT TIME
//   // ============================================================

//   private formatTime(
//     time: string,
//   ): string {
//     const [hours, minutes] =
//       time
//         .slice(0, 5)
//         .split(':')
//         .map(Number);

//     const period =
//       hours >= 12 ? 'PM' : 'AM';

//     const displayHour =
//       hours % 12 || 12;

//     return `${displayHour}:${String(
//       minutes,
//     ).padStart(2, '0')} ${period}`;
//   }



//   private getAppointmentTime(
//   appointmentEntity: appointment,
// ): string | null {
//   const schedulingType =
//     appointmentEntity
//       .recurringAvailability
//       ?.schedulingType;

//   if (
//     schedulingType ===
//     SchedulingType.STREAM
//   ) {
//     return (
//       appointmentEntity
//         .recurringAvailability
//         ?.startTime ?? null
//     );
//   }

//   if (
//     schedulingType ===
//     SchedulingType.WAVE
//   ) {
//     return (
//       appointmentEntity
//         .slotStartTime ?? null
//     );
//   }

//   return null;


// }


// private buildReminderEmail(
//   appointmentEntity: appointment,
//   schedulingType: SchedulingType,
//   appointmentTime: string | null,
// ): string {
//   const doctorName =
//     appointmentEntity.doctor.fullName;

//   const date =
//     appointmentEntity.appointmentDate;

//   if (
//     schedulingType ===
//     SchedulingType.STREAM
//   ) {
//     return `
//       <div
//         style="
//           font-family: Arial, sans-serif;
//           max-width: 600px;
//           margin: auto;
//           padding: 20px;
//         "
//       >
//         <h2>Appointment Reminder</h2>

//         <p>
//           Hello
//           ${appointmentEntity.patient.user.name ?? 'Patient'},
//         </p>

//         <p>
//           This is a reminder for your upcoming
//           appointment.
//         </p>

//         <p>
//           <strong>Doctor:</strong>
//           ${doctorName}
//         </p>

//         <p>
//           <strong>Appointment Date:</strong>
//           ${date}
//         </p>

//         <p>
//           <strong>Appointment Time:</strong>
//           ${appointmentTime ?? 'N/A'}
//         </p>

//         <p>
//           <strong>Appointment ID:</strong>
//           #${appointmentEntity.id}
//         </p>

//         <p>
//           Please be available at the scheduled time.
//         </p>
//       </div>
//     `;
//   }

//   /*
//    * WAVE
//    */
//   return `
//     <div
//       style="
//         font-family: Arial, sans-serif;
//         max-width: 600px;
//         margin: auto;
//         padding: 20px;
//       "
//     >
//       <h2>Appointment Reminder</h2>

//       <p>
//         Hello
//         ${appointmentEntity.patient.user.name ?? 'Patient'},
//       </p>

//       <p>
//         This is a reminder for your upcoming
//         appointment.
//       </p>

//       <p>
//         <strong>Doctor:</strong>
//         Dr. ${doctorName}
//       </p>

//       <p>
//         <strong>Reporting Time:</strong>
//         ${appointmentTime ?? 'N/A'}
//       </p>

//       <p>
//         <strong>Token Number:</strong>
//         ${appointmentEntity.tokenNumber ?? 'N/A'}
//       </p>

//       <p>
//         <strong>Appointment ID:</strong>
//         #${appointmentEntity.id}
//       </p>

//       <p>
//         Please report on time.
//       </p>
//     </div>
//   `;
// }
// }


import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';

import { EmailService } from '../email/email.service';
import { Notification } from '../notification/notification.entity';

import {
  InjectRepository,
} from '@nestjs/typeorm';

import {
  Repository,
  In,
} from 'typeorm';

import {
  appointment,
  appointmentStatus,
} from '../appointment/appointment.entity';

import {
  SchedulingType,
} from '../recurring-availability/entities/recurring-availability.entity';

import {
  NotificationService,
} from '../notification/notification.service';

import {
  NotificationType,
} from '../notification/notification-type.enum';

@Injectable()
export class AppointmentReminderService {
  private readonly logger =
    new Logger(
      AppointmentReminderService.name,
    );

  /**
   * For testing:
   * 2 minutes before appointment.
   *
   * Change to 30 for production/submission.
   */
  private readonly REMINDER_MINUTES = 2;

  /**
   * Cron runs every minute.
   *
   * With REMINDER_MINUTES = 2,
   * appointments between approximately
   * 1 and 3 minutes away are considered.
   */
  private readonly REMINDER_WINDOW_MINUTES = 1;

  constructor(
    @InjectRepository(appointment)
    private readonly appointmentRepository:
      Repository<appointment>,

    private readonly notificationService:
      NotificationService,

    private readonly emailService:
      EmailService,
  ) {}

  // ============================================================
  // AUTOMATIC CRON JOB
  // ============================================================

  @Cron(CronExpression.EVERY_MINUTE)
  async generateAppointmentReminders(): Promise<void> {
    await this.runReminderJob(true);
  }

  // ============================================================
  // SHARED REMINDER JOB
  // ============================================================

  /**
   * Runs the reminder process.
   *
   * checkTimeWindow = true
   * ----------------------
   * Used by Cron and POST /run.
   *
   * checkTimeWindow = false
   * -----------------------
   * Used by POST /:appointmentId
   * so a specific appointment can be
   * manually tested without waiting.
   */
  async runReminderJob(
    checkTimeWindow = true,
  ) {
    this.logger.log(
      'Running appointment reminder job...',
    );

    try {
      let appointments:
        appointment[];

      if (checkTimeWindow) {
        appointments =
          await this.findUpcomingAppointments();
      } else {
        appointments =
          await this.findActiveAppointments();
      }

      this.logger.log(
        `Found ${appointments.length} appointment(s) to process.`,
      );

      let processed = 0;
      let skipped = 0;

      for (
        const appointmentEntity of appointments
      ) {
        const result =
          await this.processAppointment(
            appointmentEntity,
          );

        if (result.created) {
          processed++;
        } else {
          skipped++;
        }
      }

      return {
        found: appointments.length,
        processed,
        skipped,
        message:
          'Appointment reminder job executed successfully',
      };
    } catch (error) {
      this.logger.error(
        'Appointment reminder job failed',
        error instanceof Error
          ? error.stack
          : error,
      );

      throw error;
    }
  }

  // ============================================================
  // FIND UPCOMING APPOINTMENTS
  // ============================================================

  private async findUpcomingAppointments(): Promise<
    appointment[]
  > {
    const now = new Date();

    const reminderFrom =
      new Date(
        now.getTime() +
          (
            this.REMINDER_MINUTES -
            this.REMINDER_WINDOW_MINUTES
          ) *
            60 *
            1000,
      );

    const reminderTo =
      new Date(
        now.getTime() +
          (
            this.REMINDER_MINUTES +
            this.REMINDER_WINDOW_MINUTES
          ) *
            60 *
            1000,
      );

    const today =
      this.formatDateForDatabase(now);

    const tomorrowDate =
      new Date(now);

    tomorrowDate.setDate(
      tomorrowDate.getDate() + 1,
    );

    const tomorrow =
      this.formatDateForDatabase(
        tomorrowDate,
      );

    const appointments =
      await this.appointmentRepository.find({
        where: {
          appointmentDate: In([
            today,
            tomorrow,
          ]),

          /*
           * Only active appointments are
           * eligible for reminders.
           *
           * COMPLETED and CANCELLED are
           * automatically excluded.
           */
          status: In([
            appointmentStatus.BOOKED,
            appointmentStatus.RESCHEDULED,
          ]),
        },

        relations: {
          doctor: true,

          patient: {
            user: true,
          },

          recurringAvailability: true,
        },

        order: {
          appointmentDate: 'ASC',
          createdAt: 'ASC',
        },
      });

    return appointments.filter(
      (appointmentEntity) => {
        const appointmentDateTime =
          this.getAppointmentDateTime(
            appointmentEntity,
          );

        if (!appointmentDateTime) {
          return false;
        }

        return (
          appointmentDateTime >=
            reminderFrom &&
          appointmentDateTime <
            reminderTo
        );
      },
    );
  }

  // ============================================================
  // FIND ACTIVE APPOINTMENTS
  // ============================================================

  /**
   * Used by the manual /run endpoint.
   *
   * It finds active appointments without
   * applying the reminder time window.
   *
   * This is useful for testing.
   */
  private async findActiveAppointments(): Promise<
    appointment[]
  > {
    const today =
      this.formatDateForDatabase(
        new Date(),
      );

    const tomorrowDate =
      new Date();

    tomorrowDate.setDate(
      tomorrowDate.getDate() + 1,
    );

    const tomorrow =
      this.formatDateForDatabase(
        tomorrowDate,
      );

    return this.appointmentRepository.find({
      where: {
        appointmentDate: In([
          today,
          tomorrow,
        ]),

        status: In([
          appointmentStatus.BOOKED,
          appointmentStatus.RESCHEDULED,
        ]),
      },

      relations: {
        doctor: true,

        patient: {
          user: true,
        },

        recurringAvailability: true,
      },

      order: {
        appointmentDate: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  // ============================================================
  // MANUAL SINGLE APPOINTMENT
  // ============================================================

  async generateReminderForAppointment(
    appointmentId: number,
  ) {
    const appointmentEntity =
      await this.appointmentRepository.findOne({
        where: {
          id: appointmentId,
        },

        relations: {
          doctor: true,

          patient: {
            user: true,
          },

          recurringAvailability: true,
        },
      });

    if (!appointmentEntity) {
      throw new NotFoundException(
        `Appointment #${appointmentId} not found`,
      );
    }

    /*
     * IMPORTANT:
     * Manual endpoint bypasses only the
     * time-window requirement.
     *
     * It does NOT bypass status validation.
     */
    if (
      appointmentEntity.status !==
        appointmentStatus.BOOKED &&
      appointmentEntity.status !==
        appointmentStatus.RESCHEDULED
    ) {
      return {
        created: false,

        appointmentId,

        status:
          appointmentEntity.status,

        message:
          `Appointment is ${appointmentEntity.status} and is not eligible for a reminder`,
      };
    }

    return this.processAppointment(
      appointmentEntity,
    );
  }

  // ============================================================
  // PROCESS APPOINTMENT
  // ============================================================

  private async processAppointment(
    appointmentEntity: appointment,
  ) {
    // ----------------------------------------------------------
    // VALIDATE APPOINTMENT ID
    // ----------------------------------------------------------

    if (!appointmentEntity.id) {
      this.logger.warn(
        'Skipping appointment with invalid ID.',
      );

      return {
        created: false,
        message:
          'Invalid appointment ID',
      };
    }

    // ----------------------------------------------------------
    // VALIDATE STATUS
    // ----------------------------------------------------------

    if (
      appointmentEntity.status !==
        appointmentStatus.BOOKED &&
      appointmentEntity.status !==
        appointmentStatus.RESCHEDULED
    ) {
      this.logger.log(
        `Skipping appointment #${appointmentEntity.id}: status is ${appointmentEntity.status}`,
      );

      return {
        created: false,

        appointmentId:
          appointmentEntity.id,

        status:
          appointmentEntity.status,

        message:
          'Appointment is not eligible for reminder',
      };
    }

    // ----------------------------------------------------------
    // VALIDATE DOCTOR
    // ----------------------------------------------------------

    if (!appointmentEntity.doctor) {
      this.logger.warn(
        `Skipping appointment #${appointmentEntity.id}: doctor not found.`,
      );

      return {
        created: false,

        appointmentId:
          appointmentEntity.id,

        message:
          'Doctor information is missing',
      };
    }

    // ----------------------------------------------------------
    // VALIDATE PATIENT
    // ----------------------------------------------------------

    if (!appointmentEntity.patient) {
      this.logger.warn(
        `Skipping appointment #${appointmentEntity.id}: patient not found.`,
      );

      return {
        created: false,

        appointmentId:
          appointmentEntity.id,

        message:
          'Patient information is missing',
      };
    }

    // ----------------------------------------------------------
    // VALIDATE PATIENT USER
    // ----------------------------------------------------------

    if (!appointmentEntity.patient.user) {
      this.logger.warn(
        `Skipping appointment #${appointmentEntity.id}: patient user not found.`,
      );

      return {
        created: false,

        appointmentId:
          appointmentEntity.id,

        message:
          'Patient user information is missing',
      };
    }

    // ----------------------------------------------------------
    // VALIDATE EMAIL
    // ----------------------------------------------------------

    if (
      !appointmentEntity.patient.user.email
    ) {
      this.logger.warn(
        `Skipping appointment #${appointmentEntity.id}: patient email not found.`,
      );

      return {
        created: false,

        appointmentId:
          appointmentEntity.id,

        message:
          'Patient email is missing',
      };
    }

    // ----------------------------------------------------------
    // VALIDATE AVAILABILITY
    // ----------------------------------------------------------

    if (
      !appointmentEntity
        .recurringAvailability
    ) {
      this.logger.warn(
        `Skipping appointment #${appointmentEntity.id}: recurring availability not found.`,
      );

      return {
        created: false,

        appointmentId:
          appointmentEntity.id,

        message:
          'Scheduling information is missing',
      };
    }

    // ----------------------------------------------------------
    // BUILD REMINDER MESSAGE
    // ----------------------------------------------------------

    const message =
      this.buildReminderMessage(
        appointmentEntity,
      );

    if (!message) {
      this.logger.warn(
        `Skipping appointment #${appointmentEntity.id}: incomplete reminder data.`,
      );

      return {
        created: false,

        appointmentId:
          appointmentEntity.id,

        message:
          'Incomplete appointment reminder data',
      };
    }

    // ----------------------------------------------------------
    // UNIQUE REMINDER EVENT
    // ----------------------------------------------------------

    const eventId =
      `APPOINTMENT_REMINDER_${appointmentEntity.id}`;

    // ----------------------------------------------------------
    // CHECK WHETHER REMINDER ALREADY EXISTS
    // ----------------------------------------------------------

    let existingReminder: Notification | null = null;

    try {
      existingReminder =
        await this.notificationService
          .getAppointmentReminder(
            appointmentEntity.id,
          );
    } catch (error) {
      /*
       * Notification not found is expected.
       *
       * Any other error should be re-thrown.
       */
      if (
        !(error instanceof NotFoundException)
      ) {
        throw error;
      }
    }

    if (existingReminder) {
      this.logger.log(
        `Reminder already exists for appointment #${appointmentEntity.id}. Skipping duplicate notification/email.`,
      );

      return {
        created: false,

        duplicate: true,

        appointmentId:
          appointmentEntity.id,

        notificationId:
          existingReminder.id,

        message:
          'Appointment reminder already exists',
      };
    }

    // ----------------------------------------------------------
    // CREATE IN-APP NOTIFICATION
    // ----------------------------------------------------------

    const notification =
      await this.notificationService
        .createAppointmentNotification({
          patientId:
            appointmentEntity.patient.id,

          appointmentId:
            appointmentEntity.id,

          type:
            NotificationType.APPOINTMENT_REMINDER,

          title:
            'Appointment Reminder',

          message,

          eventId,
        });

    // ----------------------------------------------------------
    // SEND EMAIL ONLY FOR NEW REMINDER
    // ----------------------------------------------------------

    try {
      const schedulingType =
        appointmentEntity
          .recurringAvailability
          .schedulingType;

      const appointmentTime =
        this.getAppointmentTime(
          appointmentEntity,
        );

      await this.emailService.sendEmail(
        appointmentEntity.patient.user.email,

        'Appointment Reminder',

        this.buildReminderEmail(
          appointmentEntity,
          schedulingType,
          appointmentTime,
        ),
      );

      this.logger.log(
        `Reminder email sent to ${appointmentEntity.patient.user.email} for appointment #${appointmentEntity.id}`,
      );
    } catch (error) {
      /*
       * Notification has already been created.
       *
       * Email failure should not crash
       * the reminder job.
       */
      this.logger.error(
        `Reminder notification was created for appointment #${appointmentEntity.id}, but email sending failed.`,
        error instanceof Error
          ? error.stack
          : error,
      );
    }

    this.logger.log(
      `Appointment reminder processed for #${appointmentEntity.id}. Notification #${notification.id}`,
    );

    return {
      created: true,

      appointmentId:
        appointmentEntity.id,

      notificationId:
        notification.id,

      message:
        'Appointment reminder created successfully',
    };
  }

  // ============================================================
  // GET REMINDER FOR APPOINTMENT
  // ============================================================

  async getReminderForAppointment(
    appointmentId: number,
  ) {
    return this.notificationService
      .getAppointmentReminder(
        appointmentId,
      );
  }

  // ============================================================
  // BUILD REMINDER MESSAGE
  // ============================================================

  private buildReminderMessage(
    appointmentEntity: appointment,
  ): string | null {
    const schedulingType =
      appointmentEntity
        .recurringAvailability
        ?.schedulingType;

    if (
      schedulingType ===
      SchedulingType.STREAM
    ) {
      return this.buildStreamReminder(
        appointmentEntity,
      );
    }

    if (
      schedulingType ===
      SchedulingType.WAVE
    ) {
      return this.buildWaveReminder(
        appointmentEntity,
      );
    }

    this.logger.warn(
      `Unknown scheduling type for appointment #${appointmentEntity.id}`,
    );

    return null;
  }

  // ============================================================
  // STREAM REMINDER
  // ============================================================

  private buildStreamReminder(
    appointmentEntity: appointment,
  ): string | null {
    const doctorName =
      appointmentEntity.doctor?.fullName;

    const appointmentDate =
      appointmentEntity.appointmentDate;

    const appointmentTime =
      appointmentEntity
        .recurringAvailability
        ?.startTime;

    if (
      !doctorName ||
      !appointmentDate ||
      !appointmentTime
    ) {
      return null;
    }

    return (
      `Reminder: You have an appointment with ` +
      `Dr. ${doctorName} today.\n\n` +
      `Appointment Date: ${appointmentDate}\n` +
      `Appointment Time: ${this.formatTime(
        appointmentTime,
      )}`
    );
  }

  // ============================================================
  // WAVE REMINDER
  // ============================================================

  private buildWaveReminder(
    appointmentEntity: appointment,
  ): string | null {
    const doctorName =
      appointmentEntity.doctor?.fullName;

    /*
     * Wave uses slotStartTime as
     * the reporting time.
     *
     * Wave does NOT have a token number
     * in your existing scheduling model.
     */
    const reportingTime =
      appointmentEntity.slotStartTime;

    if (
      !doctorName ||
      !reportingTime
    ) {
      return null;
    }

    return (
      `Reminder: You have an appointment with ` +
      `Dr. ${doctorName} today.\n\n` +
      `Reporting Time: ${this.formatTime(
        reportingTime,
      )}`
    );
  }

  // ============================================================
  // GET APPOINTMENT DATETIME
  // ============================================================

  private getAppointmentDateTime(
    appointmentEntity: appointment,
  ): Date | null {
    if (
      !appointmentEntity.appointmentDate
    ) {
      return null;
    }

    const schedulingType =
      appointmentEntity
        .recurringAvailability
        ?.schedulingType;

    let time: string | null = null;

    // STREAM
    if (
      schedulingType ===
      SchedulingType.STREAM
    ) {
      time =
        appointmentEntity
          .recurringAvailability
          ?.startTime ?? null;
    }

    // WAVE
    if (
      schedulingType ===
      SchedulingType.WAVE
    ) {
      time =
        appointmentEntity
          .slotStartTime ?? null;
    }

    if (!time) {
      return null;
    }

    const appointmentDateTime =
      new Date(
        `${appointmentEntity.appointmentDate}T${time}`,
      );

    if (
      Number.isNaN(
        appointmentDateTime.getTime(),
      )
    ) {
      return null;
    }

    return appointmentDateTime;
  }

  // ============================================================
  // GET APPOINTMENT TIME
  // ============================================================

  private getAppointmentTime(
    appointmentEntity: appointment,
  ): string | null {
    const schedulingType =
      appointmentEntity
        .recurringAvailability
        ?.schedulingType;

    if (
      schedulingType ===
      SchedulingType.STREAM
    ) {
      return (
        appointmentEntity
          .recurringAvailability
          ?.startTime ?? null
      );
    }

    if (
      schedulingType ===
      SchedulingType.WAVE
    ) {
      return (
        appointmentEntity
          .slotStartTime ?? null
      );
    }

    return null;
  }

  // ============================================================
  // BUILD REMINDER EMAIL
  // ============================================================

  private buildReminderEmail(
    appointmentEntity: appointment,
    schedulingType: SchedulingType,
    appointmentTime: string | null,
  ): string {
    const doctorName =
      appointmentEntity.doctor.fullName;

    const date =
      appointmentEntity.appointmentDate;

    const patientName =
      appointmentEntity.patient.user
        ?.name ?? 'Patient';

    // ----------------------------------------------------------
    // STREAM EMAIL
    // ----------------------------------------------------------

    if (
      schedulingType ===
      SchedulingType.STREAM
    ) {
      return `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 20px;
          "
        >
          <h2>Appointment Reminder</h2>

          <p>
            Hello ${patientName},
          </p>

          <p>
            This is a reminder for your upcoming
            appointment.
          </p>

          <p>
            <strong>Doctor:</strong>
            Dr. ${doctorName}
          </p>

          <p>
            <strong>Appointment Date:</strong>
            ${date}
          </p>

          <p>
            <strong>Appointment Time:</strong>
            ${appointmentTime ?? 'N/A'}
          </p>

          <p>
            <strong>Appointment ID:</strong>
            #${appointmentEntity.id}
          </p>

          <p>
            Please be available at the scheduled time.
          </p>
        </div>
      `;
    }

    // ----------------------------------------------------------
    // WAVE EMAIL
    // ----------------------------------------------------------

    return `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: auto;
          padding: 20px;
        "
      >
        <h2>Appointment Reminder</h2>

        <p>
          Hello ${patientName},
        </p>

        <p>
          This is a reminder for your upcoming
          appointment.
        </p>

        <p>
          <strong>Doctor:</strong>
          Dr. ${doctorName}
        </p>

        <p>
          <strong>Reporting Time:</strong>
          ${appointmentTime ?? 'N/A'}
        </p>

        <p>
          <strong>Appointment ID:</strong>
          #${appointmentEntity.id}
        </p>

        <p>
          Please report on time.
        </p>
      </div>
    `;
  }

  // ============================================================
  // FORMAT DATE
  // ============================================================

  private formatDateForDatabase(
    date: Date,
  ): string {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1,
      ).padStart(2, '0');

    const day =
      String(
        date.getDate(),
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // ============================================================
  // FORMAT TIME
  // ============================================================

  private formatTime(
    time: string,
  ): string {
    const [hours, minutes] =
      time
        .slice(0, 5)
        .split(':')
        .map(Number);

    const period =
      hours >= 12
        ? 'PM'
        : 'AM';

    const displayHour =
      hours % 12 || 12;

    return `${displayHour}:${String(
      minutes,
    ).padStart(2, '0')} ${period}`;
  }
}