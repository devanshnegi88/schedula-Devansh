import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  Repository,
} from 'typeorm';

import { Notification } from './notification.entity';
import { NotificationType } from './notification-type.enum';

import { Patient } from '../patient/patient.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository:
      Repository<Notification>,

    @InjectRepository(Patient)
    private readonly patientRepository:
      Repository<Patient>,
  ) {}

  // ============================================================
  // CREATE APPOINTMENT NOTIFICATION
  // ============================================================

  async createAppointmentNotification(
    params: {
      patientId: number;
      appointmentId: number;
      type: NotificationType;
      title: string;
      message: string;
      eventId: string;
    },
    manager?: EntityManager,
  ) {
    // Use transaction repository when called
    // from an appointment transaction.
    const repository = manager
      ? manager.getRepository(Notification)
      : this.notificationRepository;

    // Prevent duplicate notification
    // for the same appointment event.
    const existing =
      await repository.findOne({
        where: {
          appointmentId:
            params.appointmentId,
          eventId: params.eventId,
        },
      });

    if (existing) {
      return existing;
    }

    return repository.save({
      patientId:
        params.patientId,

      appointmentId:
        params.appointmentId,

      type:
        params.type,

      title:
        params.title,

      message:
        params.message,

      eventId:
        params.eventId,
    });
  }

  // ============================================================
  // GET ALL NOTIFICATIONS FOR PATIENT
  // ============================================================

  async findAllForPatient(
    patientId: number,
  ) {
    return this.notificationRepository.find({
      where: {
        patientId,
      },

      order: {
        createdAt: 'DESC',
      },
    });
  }

  // ============================================================
  // GET LATEST NOTIFICATION FOR APPOINTMENT
  // ============================================================

  async getLatestAppointmentNotification(
    appointmentId: number,
    userId: number,
  ) {
    const patient =
      await this.patientRepository.findOne({
        where: {
          user: {
            id: userId,
          },
        },
      });

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    const notification =
      await this.notificationRepository.findOne({
        where: {
          appointmentId,
          patientId: patient.id,
        },

        order: {
          createdAt: 'DESC',
        },
      });

    if (!notification) {
      throw new NotFoundException(
        'Notification not found for this appointment',
      );
    }

    return notification;
  }

  // ============================================================
  // GET ALL NOTIFICATIONS FOR APPOINTMENT
  // ============================================================

  async getAppointmentNotifications(
    appointmentId: number,
    userId: number,
  ) {
    const patient =
      await this.patientRepository.findOne({
        where: {
          user: {
            id: userId,
          },
        },
      });

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found',
      );
    }

    return this.notificationRepository.find({
      where: {
        appointmentId,
        patientId: patient.id,
      },

      order: {
        createdAt: 'DESC',
      },
    });
  }
}