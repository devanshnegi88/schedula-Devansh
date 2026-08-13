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


async findAllForPatient(patientId: number) {
  const notifications =
    await this.notificationRepository.find({
      where: {
        patientId,
      },
      order: {
        createdAt: 'DESC',
      },
    });

  const totalCount = notifications.length;

  const unreadCount = notifications.filter(
    (notification) => notification.isRead === false,
  ).length;

  return {
    notifications,
    totalCount,
    unreadCount,
  };
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

  return {
    id: notification.id,
    patientId: notification.patientId,
    appointmentId: notification.appointmentId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    eventId: notification.eventId,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
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

  const notifications =
    await this.notificationRepository.find({
      where: {
        appointmentId,
        patientId: patient.id,
      },
      order: {
        createdAt: 'DESC',
      },
    });

  const totalCount = notifications.length;

  const unreadCount = notifications.filter(
    (notification) =>
      notification.isRead === false,
  ).length;

  return {
    notifications,
    totalCount,
    unreadCount,
  };
}



  async markAsRead(
  notificationId: number,
  userId: number,
) {
  const patient = await this.patientRepository.findOne({
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
        id: notificationId,
        patientId: patient.id,
      },
    });

  if (!notification) {
    throw new NotFoundException(
      'Notification not found',
    );
  }

  notification.isRead = true;

  await this.notificationRepository.save(notification);

  return {
    id: notification.id,
    patientId: notification.patientId,
    appointmentId: notification.appointmentId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    eventId: notification.eventId,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

async markAllAsRead(
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

  const result =
    await this.notificationRepository.update(
      {
        patientId: patient.id,
        isRead: false,
      },
      {
        isRead: true,
      },
    );

  return {
    updatedCount: result.affected ?? 0,
    unreadCount: 0,
  };
}

// ============================================================
// DELETE ONE NOTIFICATION
// ============================================================

async deleteNotification(
  notificationId: number,
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
        id: notificationId,
        patientId: patient.id,
      },
    });

  if (!notification) {
    throw new NotFoundException(
      'Notification not found',
    );
  }

  await this.notificationRepository.delete(
    notification.id,
  );

  return {
    id: notification.id,
    message: 'Notification deleted successfully',
  };
}

// ============================================================
// DELETE ALL NOTIFICATIONS
// ============================================================

async deleteAllNotifications(
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

  const result =
    await this.notificationRepository.delete({
      patientId: patient.id,
    });

  return {
    deletedCount: result.affected ?? 0,
    message: 'All notifications deleted successfully',
  };
}

async getPatientByUserId(userId: number) {
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

  return patient;
}

async getAppointmentReminder(
  appointmentId: number,
) {
  const notification =
    await this.notificationRepository.findOne({
      where: {
        appointmentId,
        type:
          NotificationType.APPOINTMENT_REMINDER,
      },
      order: {
        createdAt: 'DESC',
      },
    });

  if (!notification) {
    throw new NotFoundException(
      'Appointment reminder not found',
    );
  }

  return notification;
}
}