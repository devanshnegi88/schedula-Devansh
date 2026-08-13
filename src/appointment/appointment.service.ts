import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import {
  appointmentBookedTemplate,
  appointmentRescheduledTemplate,
  appointmentCancelledTemplate,
} from '../email/email.templates';

import { In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
} from 'typeorm';

import { appointmentStatus } from './appointment.entity';
import { ForbiddenException } from '@nestjs/common';
import { RescheduleappointmentDto } from './reschedule-appointment.dto';

import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification-type.enum';
import { EmailService } from '../email/email.service';

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
export class appointmentService {
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

    private readonly notificationService: NotificationService,

    private readonly emailService: EmailService,
  ) {}

  // ============================================================
  // RESOLVE AVAILABILITY
  // ============================================================

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
      source: customAvailability
        ? 'CUSTOM'
        : 'RECURRING',
      availability,
    };
  }

  // ============================================================
  // GET AVAILABLE SLOTS
  // ============================================================

  async getAvailableSlots(
    doctorId: number,
    date: string,
  ) {
    const doctor =
      await this.doctorRepository.findOne({
        where: {
          id: doctorId,
        },
        relations: {
          user: true,
        },
      });

    if (!doctor) {
      throw new NotFoundException(
        'Doctor not found',
      );
    }

    const {
      source,
      availability,
    } = await this.resolveAvailability(
      doctorId,
      date,
    );

    // =======================
    // STREAM SCHEDULING
    // =======================

    if (
      availability.schedulingType ===
      SchedulingType.STREAM
    ) {
      const booked =
        await this.appointmentRepository.count({
          where: {
            recurringAvailability: {
              id: availability.id,
            },
            appointmentDate: date,
            status: In([
              appointmentStatus.BOOKED,
              appointmentStatus.RESCHEDULED,
            ]),
          },
        });

      return {
        source,
        schedulingType:
          availability.schedulingType,
        availabilityId:
          availability.id,
        date,
        startTime:
          availability.startTime,
        endTime:
          availability.endTime,
        capacity:
          availability.capacity,
        booked,
        remaining:
          (availability.capacity ?? 0) -
          booked,
      };
    }

    // =======================
    // WAVE SCHEDULING
    // =======================

    const slots =
      this.generateWaveSlots(
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
          status: In([
            appointmentStatus.BOOKED,
            appointmentStatus.RESCHEDULED,
          ]),
        },
      });

    console.log(
      'Requested date:',
      date,
    );

    console.log(
      'Availability ID:',
      availability.id,
    );

    console.log(
      'Booked appointments:',
      bookedAppointments,
    );

    const availableSlots =
      slots.map((slot) => {
        const booked =
          bookedAppointments.filter(
            (appointment) =>
              appointment.slotStartTime
                ?.substring(0, 5) ===
              slot.startTime,
          ).length;

        const capacity =
          availability.capacity ?? 1;

        const remaining =
          capacity - booked;

        return {
          startTime:
            slot.startTime,
          endTime:
            slot.endTime,
          capacity,
          booked,
          remaining,
          available:
            remaining > 0,
        };
      });

    return {
      source,
      schedulingType:
        availability.schedulingType,
      availabilityId:
        availability.id,
      date,
      slots: availableSlots,
    };
  }

  // ============================================================
  // BOOK APPOINTMENT
  // ============================================================

  async bookAppointment(
  doctorId: number,
  patientId: number,
  availabilityId: number,
  appointmentDate: string,
  slotStartTime?: string,
) {
  const result =
    await this.dataSource.transaction(
      async (manager) => {
        const doctor =
          await manager.findOne(Doctor, {
            where: {
              id: doctorId,
            },
            relations: {
              user: true,
            },
          });

        if (!doctor) {
          throw new NotFoundException(
            'Doctor not found',
          );
        }

        const patient =
          await manager.findOne(
            Patient,
            {
              where: {
                id: patientId,
              },
              relations: {
                user: true,
              },
            },
          );

        if (!patient) {
          throw new NotFoundException(
            'Patient not found',
          );
        }

        // ============================================================
        // PREVENT MULTIPLE ACTIVE APPOINTMENTS
        // WITH THE SAME DOCTOR
        // ============================================================

        const existingAppointment =
          await manager.findOne(
            appointment,
            {
              where: {
                patient: {
                  id: patientId,
                },

                doctor: {
                  id: doctorId,
                },

                status: In([
                  appointmentStatus.BOOKED,
                  appointmentStatus.RESCHEDULED,
                ]),
              },
            },
          );

        if (existingAppointment) {
          throw new BadRequestException(
            `You already have an active appointment with this doctor (Appointment #${existingAppointment.id}). Please cancel or reschedule it before booking another appointment with this doctor.`,
          );
        }

        const {
          source,
          availability,
        } =
          await this.resolveAvailability(
            doctorId,
            appointmentDate,
            manager,
          );

        if (
          availability.id !==
          availabilityId
        ) {
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

        const appointmentDateTime =
          new Date(
            `${appointmentDate}T${bookingTime}`,
          );

        if (
          appointmentDateTime <=
          new Date()
        ) {
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
          await manager.findOne(
            appointment,
            {
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
                recurringAvailability:
                  true,
              },
            },
          );

        if (
          duplicate &&
          duplicate.status !==
            appointmentStatus.CANCELLED
        ) {
          throw new BadRequestException(
            'Appointment already booked',
          );
        }

        // ============================================================
        // STREAM SCHEDULING
        // ============================================================

        if (
          availability.schedulingType ===
          SchedulingType.STREAM
        ) {
          await manager
            .createQueryBuilder(
              RecurringAvailability,
              'availability',
            )
            .setLock(
              'pessimistic_write',
            )
            .where(
              'availability.id = :id',
              {
                id: availability.id,
              },
            )
            .getOne();

          const bookedPatients =
            await manager
              .getRepository(
                appointment,
              )
              .count({
                where: {
                  recurringAvailability: {
                    id: availability.id,
                  },

                  appointmentDate,

                  status: In([
                    appointmentStatus.BOOKED,
                    appointmentStatus.RESCHEDULED,
                  ]),
                },
              });

          if (
            bookedPatients >=
            (availability.capacity ??
              0)
          ) {
            const next =
              await this.findNextAvailableStream(
                doctorId,
                appointmentDate,
                manager,
              );

            throw new BadRequestException({
              message:
                'Stream is full',

              nextAvailable:
                next,
            });
          }

          const newAppointment =
            this.appointmentRepository.create({
              doctor,

              patient,

              recurringAvailability:
                availability,

              appointmentDate,

              tokenNumber:
                bookedPatients + 1,

              slotStartTime: null,

              slotEndTime: null,
            });

          const savedAppointment =
            await manager.save(
              newAppointment,
            );

          const notification =
            await this.notificationService
              .createAppointmentNotification(
                {
                  patientId:
                    patient.id,

                  appointmentId:
                    savedAppointment.id,

                  type:
                    NotificationType.APPOINTMENT_BOOKED,

                  eventId:
                    `BOOKING_${savedAppointment.id}`,

                  title:
                    'Appointment Booked',

                  message:
                    `Your appointment with ${doctor.fullName} has been booked successfully for ${appointmentDate} at ${availability.startTime}.`,
                },

                manager,
              );

          return {
            appointment:
              savedAppointment,

            notification,

            patientEmail:
              patient.user.email,

            patientName:
              patient.user.name,

            doctorName:
              doctor.fullName,

            appointmentTime:
              availability.startTime,
          };
        }

        // ============================================================
        // WAVE SCHEDULING
        // ============================================================

        if (
          availability.schedulingType ===
          SchedulingType.WAVE
        ) {
          const slots =
            this.generateWaveSlots(
              availability.startTime,
              availability.endTime,
              availability.slotDuration!,
              availability.bufferTime ??
                0,
            );

          const selected =
            slots.find(
              (slot) =>
                slot.startTime ===
                slotStartTime,
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
            .setLock(
              'pessimistic_write',
            )
            .where(
              'availability.id = :id',
              {
                id: availability.id,
              },
            )
            .getOne();

          const bookedCount =
            await manager
              .getRepository(
                appointment,
              )
              .count({
                where: {
                  recurringAvailability: {
                    id: availability.id,
                  },

                  appointmentDate,

                  slotStartTime,

                  status: In([
                    appointmentStatus.BOOKED,
                    appointmentStatus.RESCHEDULED,
                  ]),
                },
              });

          if (
            bookedCount >=
            (availability.capacity ??
              0)
          ) {
            const next =
              await this.findNextAvailableSlot(
                availability,
                appointmentDate,
                manager,
              );

            throw new BadRequestException({
              message:
                'Selected slot is full',

              nextAvailable:
                next,
            });
          }

          const newAppointment =
            this.appointmentRepository.create({
              doctor,

              patient,

              recurringAvailability:
                availability,

              appointmentDate,

              tokenNumber: null,

              slotStartTime:
                selected.startTime,

              slotEndTime:
                selected.endTime,
            });

          const savedAppointment =
            await manager.save(
              newAppointment,
            );

          const notification =
            await this.notificationService
              .createAppointmentNotification(
                {
                  patientId:
                    patient.id,

                  appointmentId:
                    savedAppointment.id,

                  type:
                    NotificationType.APPOINTMENT_BOOKED,

                  eventId:
                    `BOOKING_${savedAppointment.id}`,

                  title:
                    'Appointment Booked',

                  message:
                    `Your appointment with ${doctor.fullName} has been booked successfully for ${appointmentDate} at ${selected.startTime}.`,
                },

                manager,
              );

          return {
            appointment:
              savedAppointment,

            notification,

            patientEmail:
              patient.user.email,

            patientName:
              patient.user.name,

            doctorName:
              doctor.fullName,

            appointmentTime:
              `${selected.startTime} - ${selected.endTime}`,
          };
        }

        throw new BadRequestException(
          'Invalid scheduling type',
        );
      },
    );

  // ============================================================
  // SEND EMAIL AFTER TRANSACTION COMMITS
  // ============================================================

  try {
    await this.emailService.sendEmail(
      result.patientEmail,

      'Appointment Booked',

      `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 20px;
          "
        >
          <h2>Appointment Booked</h2>

          <p>
            Hello ${result.patientName ?? 'Patient'},
          </p>

          <p>
            Your appointment has been
            successfully booked.
          </p>

          <p>
            <strong>Doctor:</strong>
            ${result.doctorName}
          </p>

          <p>
            <strong>Date:</strong>
            ${appointmentDate}
          </p>

          <p>
            <strong>Time:</strong>
            ${result.appointmentTime}
          </p>

          <p>
            <strong>Appointment ID:</strong>
            #${result.appointment.id}
          </p>

          <p>
            Thank you.
          </p>
        </div>
      `,
    );

    console.log(
      `Booking email sent successfully to ${result.patientEmail}`,
    );
  } catch (error) {
    console.error(
      `Appointment #${result.appointment.id} was booked successfully, but booking email failed:`,
      error,
    );
  }

  // ============================================================
  // RETURN SAME EXISTING RESPONSE STRUCTURE
  // ============================================================

  return {
    appointment:
      result.appointment,

    notification:
      result.notification,
  };
}
  // ============================================================
  // GENERATE WAVE SLOTS
  // ============================================================

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

    const start = new Date(
      `1970-01-01T${startTime}`,
    );

    const end = new Date(
      `1970-01-01T${endTime}`,
    );

    let current = new Date(start);

    while (true) {
      const slotEnd =
        new Date(current);

      slotEnd.setMinutes(
        slotEnd.getMinutes() +
          slotDuration,
      );

      if (slotEnd > end) {
        break;
      }

      slots.push({
        startTime:
          current
            .toTimeString()
            .slice(0, 5),

        endTime:
          slotEnd
            .toTimeString()
            .slice(0, 5),
      });

      current = new Date(
        slotEnd.getTime() +
          bufferTime * 60000,
      );
    }

    return slots;
  }

  // ============================================================
  // FIND NEXT AVAILABLE SLOT
  // ============================================================

  public async findNextAvailableSlot(
    availability: RecurringAvailability,
    appointmentDate: string,
    manager: EntityManager,
  ) {
    const appointmentRepository =
      manager
        ? manager.getRepository(
            appointment,
          )
        : this.appointmentRepository;

    const slots =
      this.generateWaveSlots(
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
            slotStartTime:
              slot.startTime,
            status: In([
              appointmentStatus.BOOKED,
              appointmentStatus.RESCHEDULED,
            ]),
          },
        });

      if (
        booked <
        (availability.capacity ?? 1)
      ) {
        return slot;
      }
    }

    return null;
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll() {
    return this.appointmentRepository.find({
      relations: {
        doctor: true,
        patient: true,
        recurringAvailability:
          true,
      },
      order: {
        appointmentDate: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  // ============================================================
  // FIND ONE
  // ============================================================

  async findOne(id: number) {
    const appointment =
      await this.appointmentRepository.findOne({
        where: {
          id,
        },
        relations: {
          doctor: true,
          patient: true,
          recurringAvailability:
            true,
        },
      });

    if (!appointment) {
      throw new NotFoundException(
        'Appointment not found',
      );
    }

    return appointment;
  }

  // ============================================================
  // PATIENT APPOINTMENTS
  // ============================================================

  async findPatientAppointments(
    patientId: number,
  ) {
    const appointments =
      await this.appointmentRepository.find({
        where: {
          patient: {
            id: patientId,
          },
        },
        relations: {
          doctor: true,
          recurringAvailability:
            true,
        },
        order: {
          appointmentDate: 'ASC',
          createdAt: 'ASC',
        },
      });

    if (!appointments.length) {
      throw new NotFoundException(
        'No appointments found',
      );
    }

    return appointments;
  }

  // ============================================================
  // DOCTOR APPOINTMENTS
  // ============================================================

  async findDoctorAppointments(
    doctorId: number,
  ) {
    const appointments =
      await this.appointmentRepository.find({
        where: {
          doctor: {
            id: doctorId,
          },
        },
        relations: {
          patient: true,
          recurringAvailability:
            true,
        },
        order: {
          appointmentDate: 'ASC',
          createdAt: 'ASC',
        },
      });

    if (!appointments.length) {
      throw new NotFoundException(
        'No appointments found',
      );
    }

    return appointments;
  }

  // ============================================================
  // CANCEL APPOINTMENT
  // PATIENT ONLY
  // ============================================================

  // ============================================================
// CANCEL APPOINTMENT
// PATIENT ONLY
// ============================================================

async cancelAppointment(
  appointmentId: number,
  patientId: number,
) {
  return this.dataSource.transaction(
    async (manager) => {
      const appointmentRepository =
        manager.getRepository(
          appointment,
        );

      const appointmentEntity =
        await appointmentRepository.findOne({
          where: {
            id: appointmentId,
          },
          relations: {
            patient: {
              user: true,
            },
            recurringAvailability:
              true,
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
          'You can only cancel your own appointment',
        );
      }

      if (
        appointmentEntity.status ===
        appointmentStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'Appointment is already cancelled',
        );
      }

      const appointmentTime =
        appointmentEntity
          .slotStartTime ??
        appointmentEntity
          .recurringAvailability
          .startTime;

      const appointmentDateTime =
        new Date(
          `${appointmentEntity.appointmentDate}T${appointmentTime}`,
        );

      const difference =
        appointmentDateTime.getTime() -
        Date.now();

      if (
        difference <
        30 * 60 * 1000
      ) {
        throw new BadRequestException(
          'Appointments cannot be cancelled within 30 minutes',
        );
      }

      appointmentEntity.status =
        appointmentStatus.CANCELLED;

      const cancelledAppointment =
        await appointmentRepository.save(
          appointmentEntity,
        );

      const notification =
        await this.notificationService
          .createAppointmentNotification(
            {
              patientId:
                cancelledAppointment
                  .patient.id,

              appointmentId:
                cancelledAppointment.id,

              type:
                NotificationType.APPOINTMENT_CANCELLED,

              eventId:
                `CANCELLATION_${cancelledAppointment.id}`,

              title:
                'Appointment Cancelled',

              message:
                `Your appointment scheduled on ${cancelledAppointment.appointmentDate} at ${appointmentTime} has been cancelled.`,
            },
            manager,
          );

      // ========================================================
      // EMAIL NOTIFICATION
      // Existing cancellation functionality is unchanged.
      // Email failure will NOT affect cancellation.
      // ========================================================

      try {
        await this.emailService.sendEmail(
          cancelledAppointment.patient.user.email,

          'Appointment Cancelled',

          appointmentCancelledTemplate({
            patientName:
              cancelledAppointment.patient
                .user.firstName ??
              'Patient',

            doctorName:
              'Doctor',

            date:
              cancelledAppointment
                .appointmentDate,

            time:
              appointmentTime,
          }),
        );
      } catch (error) {
        console.error(
          `Appointment #${cancelledAppointment.id} was cancelled, but email notification failed:`,
          error,
        );
      }

      return {
        appointment:
          cancelledAppointment,

        notification,
      };
    },
  );
}
  // ============================================================
  // RESCHEDULE APPOINTMENT
  // PATIENT ONLY
  // ============================================================

// ============================================================
// RESCHEDULE APPOINTMENT
// PATIENT ONLY
// ============================================================

async rescheduleAppointment(
  appointmentId: number,
  patientId: number,
  dto: RescheduleappointmentDto,
) {
  return this.dataSource.transaction(
    async (manager) => {
      const appointmentRepository =
        manager.getRepository(
          appointment,
        );

      const appointmentEntity =
        await appointmentRepository.findOne({
          where: {
            id: appointmentId,
          },

          relations: {
            patient: {
              user: true,
            },

            doctor: true,

            recurringAvailability:
              true,
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
        appointmentEntity
          .slotStartTime ??
        appointmentEntity
          .recurringAvailability
          .startTime;

      const appointmentDateTime =
        new Date(
          `${appointmentEntity.appointmentDate}T${currentTime}`,
        );

      const difference =
        appointmentDateTime.getTime() -
        Date.now();

      if (
        difference <
        30 * 60 * 1000
      ) {
        throw new BadRequestException(
          'Appointments cannot be rescheduled within 30 minutes',
        );
      }

      const {
        availability,
      } =
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
        (appointmentEntity
          .slotStartTime ?? null) ===
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

      const requestedDateTime =
        new Date(
          `${dto.appointmentDate}T${bookingTime}`,
        );

      if (
        requestedDateTime <=
        new Date()
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
          .setLock(
            'pessimistic_write',
          )
          .where(
            'availability.id = :id',
            {
              id: availability.id,
            },
          )
          .getOne();

        const booked =
          await manager.count(
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
          (availability.capacity ??
            0)
        ) {
          const next =
            await this.findNextAvailableStream(
              appointmentEntity
                .doctor.id,

              dto.appointmentDate,

              manager,
            );

          throw new BadRequestException({
            message:
              'Stream is full',

            nextAvailable:
              next,
          });
        }

        appointmentEntity
          .recurringAvailability =
          availability;

        appointmentEntity
          .appointmentDate =
          dto.appointmentDate;

        appointmentEntity
          .slotStartTime = null;

        appointmentEntity
          .slotEndTime = null;

        appointmentEntity
          .tokenNumber =
          booked + 1;

        const savedAppointment =
          await manager.save(
            appointmentEntity,
          );

        // ==========================
        // EXISTING DB NOTIFICATION
        // ==========================

        const notification =
          await this.notificationService
            .createAppointmentNotification(
              {
                patientId:
                  savedAppointment
                    .patient.id,

                appointmentId:
                  savedAppointment.id,

                type:
                  NotificationType.APPOINTMENT_RESCHEDULED,

                eventId:
                  `RESCHEDULE_${savedAppointment.id}_${savedAppointment.appointmentDate}_STREAM`,

                title:
                  'Appointment Rescheduled',

                message:
                  `Your appointment has been rescheduled to ${savedAppointment.appointmentDate} at ${availability.startTime}.`,
              },

              manager,
            );

        // ==========================
        // SENDGRID EMAIL
        // ==========================

        try {
          await this.emailService.sendEmail(
            savedAppointment.patient.user.email,

            'Appointment Rescheduled',

            appointmentRescheduledTemplate({
              recipientName:
                savedAppointment
                  .patient
                  .user
                  .firstName ??
                'Patient',

              doctorName:
                savedAppointment
                  .doctor
                  .fullName,

              date:
                savedAppointment
                  .appointmentDate,

              time:
                availability.startTime,

              reason:
                'Appointment rescheduled by patient',
            }),
          );
        } catch (error) {
          console.error(
            `Appointment #${savedAppointment.id} was rescheduled, but email notification failed:`,
            error,
          );
        }

        return {
          appointment:
            savedAppointment,

          notification,
        };
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

        const selected =
          slots.find(
            (slot) =>
              slot.startTime ===
              dto.slotStartTime,
          );

        if (!selected) {
          throw new BadRequestException(
            'Invalid slot selected',
          );
        }

        const booked =
          await manager.count(
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
          (availability.capacity ??
            0)
        ) {
          const next =
            await this.findNextAvailableStream(
              appointmentEntity
                .doctor.id,

              dto.appointmentDate,

              manager,
            );

          throw new BadRequestException({
            message:
              'Selected slot is full',

            nextAvailable:
              next,
          });
        }

        appointmentEntity
          .recurringAvailability =
          availability;

        appointmentEntity
          .appointmentDate =
          dto.appointmentDate;

        appointmentEntity
          .slotStartTime =
          selected.startTime;

        appointmentEntity
          .slotEndTime =
          selected.endTime;

        appointmentEntity
          .tokenNumber = null;

        const savedAppointment =
          await manager.save(
            appointmentEntity,
          );

        // ==========================
        // EXISTING DB NOTIFICATION
        // ==========================

        const notification =
          await this.notificationService
            .createAppointmentNotification(
              {
                patientId:
                  savedAppointment
                    .patient.id,

                appointmentId:
                  savedAppointment.id,

                type:
                  NotificationType.APPOINTMENT_RESCHEDULED,

                eventId:
                  `RESCHEDULE_${savedAppointment.id}_${savedAppointment.appointmentDate}_${savedAppointment.slotStartTime}`,

                title:
                  'Appointment Rescheduled',

                message:
                  `Your appointment has been rescheduled to ${savedAppointment.appointmentDate} at ${savedAppointment.slotStartTime}.`,
              },

              manager,
            );

        // ==========================
        // SENDGRID EMAIL
        // ==========================

        try {
          await this.emailService.sendEmail(
            savedAppointment.patient.user.email,

            'Appointment Rescheduled',

            appointmentRescheduledTemplate({
              recipientName:
                savedAppointment
                  .patient
                  .user
                  .firstName ??
                'Patient',

              doctorName:
                savedAppointment
                  .doctor
                  .fullName,

              date:
                savedAppointment
                  .appointmentDate,

              time:
                `${selected.startTime} - ${selected.endTime}`,

              reason:
                'Appointment rescheduled by patient',
            }),
          );
        } catch (error) {
          console.error(
            `Appointment #${savedAppointment.id} was rescheduled, but email notification failed:`,
            error,
          );
        }

        return {
          appointment:
            savedAppointment,

          notification,
        };
      }

      throw new BadRequestException(
        'Invalid scheduling type',
      );
    },
  );
}

  // ============================================================
  // FIND NEXT AVAILABLE STREAM
  // ============================================================

  public async findNextAvailableStream(
    doctorId: number,
    appointmentDate: string,
    manager: EntityManager,
  ) {
    let date =
      new Date(appointmentDate);

    for (let i = 0; i < 30; i++) {
      const currentDate =
        date
          .toISOString()
          .split('T')[0];

      try {
        const {
          availability,
        } =
          await this.resolveAvailability(
            doctorId,
            currentDate,
            manager,
          );

        if (
          availability.schedulingType !==
          SchedulingType.STREAM
        ) {
          date.setDate(
            date.getDate() + 1,
          );
          continue;
        }

        const booked =
          await manager.count(
            appointment,
            {
              where: {
                recurringAvailability: {
                  id: availability.id,
                },
                appointmentDate:
                  currentDate,
                status:
                  appointmentStatus.BOOKED,
              },
            },
          );

        if (
          booked <
          (availability.capacity ??
            1)
        ) {
          return {
            availabilityId:
              availability.id,

            appointmentDate:
              currentDate,

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

      date.setDate(
        date.getDate() + 1,
      );
    }

    return null;
  }

  // ============================================================
  // FIND AFFECTED APPOINTMENTS
  // ============================================================

  private async findAffectedAppointments(
    doctorId: number,
    availabilityId: number,
    effectiveDate: string,
    newStartTime: string,
    newEndTime: string,
    manager: EntityManager,
  ): Promise<appointment[]> {
    const appointmentRepository =
      manager.getRepository(
        appointment,
      );

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
          recurringAvailability:
            true,
        },
        order: {
          appointmentDate: 'ASC',
          slotStartTime: 'ASC',
          createdAt: 'ASC',
        },
      });

    const affectedAppointments:
      appointment[] = [];

    for (const booking of appointments) {
      if (
        booking.appointmentDate <
        effectiveDate
      ) {
        continue;
      }

      const availability =
        booking.recurringAvailability;

      // STREAM
      if (
        availability.schedulingType ===
        SchedulingType.STREAM
      ) {
        if (
          availability.startTime <
            newStartTime ||
          availability.endTime >
            newEndTime
        ) {
          affectedAppointments.push(
            booking,
          );
        }

        continue;
      }

      // WAVE
      const bookingStart =
        booking.slotStartTime?.slice(
          0,
          5,
        );

      const bookingEnd =
        booking.slotEndTime?.slice(
          0,
          5,
        );

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

        affectedAppointments.push(
          booking,
        );
      }
    }

    return affectedAppointments;
  }

  // ============================================================
  // FIND NEXT AVAILABLE APPOINTMENT SLOT
  // ============================================================

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
    let currentDate =
      new Date(startSearchingFrom);

    // Search next 3 working days
    for (
      let searched = 0;
      searched < 3;
      searched++
    ) {
      const date =
        currentDate
          .toISOString()
          .split('T')[0];

      try {
        const {
          availability,
        } =
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
            await manager.count(
              appointment,
              {
                where: {
                  recurringAvailability: {
                    id: availability.id,
                  },
                  appointmentDate:
                    date,
                  status: In([
                    appointmentStatus.BOOKED,
                    appointmentStatus.RESCHEDULED,
                  ]),
                },
              },
            );

          if (
            booked <
            (availability.capacity ??
              1)
          ) {
            return {
              availability,
              appointmentDate:
                date,
              slotStartTime: null,
              slotEndTime: null,
            };
          }
        }

        // ==========================
        // WAVE
        // ==========================

        const slots =
          this.generateWaveSlots(
            availability.startTime,
            availability.endTime,
            availability.slotDuration!,
            availability.bufferTime ??
              0,
          );

        for (const slot of slots) {
          const booked =
            await manager.count(
              appointment,
              {
                where: {
                  recurringAvailability: {
                    id: availability.id,
                  },
                  appointmentDate:
                    date,
                  slotStartTime:
                    slot.startTime,
                  status: In([
                    appointmentStatus.BOOKED,
                    appointmentStatus.RESCHEDULED,
                  ]),
                },
              },
            );

          if (
            booked <
            (availability.capacity ??
              1)
          ) {
            return {
              availability,
              appointmentDate:
                date,
              slotStartTime:
                slot.startTime,
              slotEndTime:
                slot.endTime,
            };
          }
        }
      } catch {
        // Doctor unavailable on this date.
      }

      currentDate.setDate(
        currentDate.getDate() + 1,
      );
    }

    return null;
  }

  // ============================================================
  // AUTOMATIC / ELASTIC RESCHEDULE
  // ============================================================

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

  appointmentEntity.rescheduledAutomatically =
    true;

  appointmentEntity.rescheduledAt =
    new Date();

  appointmentEntity.rescheduleReason =
    'DOCTOR_SHRUNK_AVAILABILITY';

  appointmentEntity.status =
    appointmentStatus.BOOKED;

  const savedAppointment =
    await manager.save(
      appointmentEntity,
    );

  const newTime =
    savedAppointment.slotStartTime ??
    savedAppointment
      .recurringAvailability
      .startTime;

  // ============================================================
  // EXISTING DATABASE NOTIFICATION
  // ============================================================

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

  // ============================================================
  // EMAIL NOTIFICATION
  // ============================================================

  try {
    const patient =
      await manager.findOne(
        Patient,
        {
          where: {
            id: savedAppointment.patient.id,
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

}