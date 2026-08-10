import {
  Controller,
  Get,
  Param,
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
        'Appointment notifications fetched successfully',

      data:
        await this.notificationService
          .getAppointmentNotifications(
            appointmentId,
            req.user.id,
          ),
    };
  }
}