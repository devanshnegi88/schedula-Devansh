import {
  Controller,
  Get,
  Param,
  Delete,
  Patch,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';

import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}



  // ============================================================
// GET ALL MY NOTIFICATIONS
// WITH TOTAL AND UNREAD COUNT
// ============================================================

@Get()
@UseGuards(JwtAuthGuard)
async getMyNotifications(@Req() req) {
  const patient =
    await this.notificationService.getPatientByUserId(
      req.user.id,
    );

  const result =
    await this.notificationService.findAllForPatient(
      patient.id,
    );

  return {
    success: true,
    message: 'Notifications fetched successfully',
    totalCount: result.totalCount,
    unreadCount: result.unreadCount,
    data: result.notifications,
  };
}

  // ============================================================
  // GET LATEST NOTIFICATION FOR APPOINTMENT
  // ============================================================

  @Get('appointment/:appointmentId')
  @UseGuards(JwtAuthGuard)
  async getAppointmentNotification(
    @Param(
      'appointmentId',
      ParseIntPipe,
    )
    appointmentId: number,

    @Req() req,
  ) {
    return {
      success: true,

      message:
        'Latest appointment notification fetched successfully',

      data:
        await this.notificationService
          .getLatestAppointmentNotification(
            appointmentId,
            req.user.id,
          ),
    };
  }
  

  // ============================================================
  // GET ALL NOTIFICATIONS FOR APPOINTMENT
  // ============================================================

 @Get('appointment/:appointmentId/all')
@UseGuards(JwtAuthGuard)
async getAppointmentNotifications(
  @Param('appointmentId', ParseIntPipe)
  appointmentId: number,
  @Req() req,
) {
  const result =
    await this.notificationService
      .getAppointmentNotifications(
        appointmentId,
        req.user.id,
      );

  return {
    success: true,
    message:
      'Appointment notifications fetched successfully',
    totalCount: result.totalCount,
    unreadCount: result.unreadCount,
    data: result.notifications,
  };
}

  @Patch(':id/read')
@UseGuards(JwtAuthGuard)
async markAsRead(
  @Param('id', ParseIntPipe) id: number,
  @Req() req,
) {
  await this.notificationService.markAsRead(
    id,
    req.user.id,
  );

  return {
    success: true,
    message: 'Notification marked as read',
  };
}


@Patch('read-all')
@UseGuards(JwtAuthGuard)
async markAllAsRead(@Req() req) {
  await this.notificationService.markAllAsRead(
    req.user.id,
  );

  return {
    success: true,
    message: 'All notifications marked as read',
  };
}

@Delete('delete-all')
@UseGuards(JwtAuthGuard)
async deleteAllNotifications(@Req() req) {
  await this.notificationService.deleteAllNotifications(
    req.user.id,
  );

  return {
    success: true,
    message: 'All notifications deleted successfully',
  };
}

@Delete(':id')
@UseGuards(JwtAuthGuard)
async deleteNotification(
  @Param('id', ParseIntPipe) id: number,
  @Req() req,
) {
  await this.notificationService.deleteNotification(
    id,
    req.user.id,
  );

  return {
    success: true,
    message: 'Notification deleted successfully',
  };
}
}