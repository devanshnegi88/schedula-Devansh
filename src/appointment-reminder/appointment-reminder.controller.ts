import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { AppointmentReminderService } from './appointment-reminder.service';

@Controller('appointment-reminder')
export class AppointmentReminderController {
  constructor(
    private readonly appointmentReminderService: AppointmentReminderService,
  ) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runReminderJob() {
    return this.appointmentReminderService.runReminderJob(true);
  }

  @Post(':appointmentId')
  @HttpCode(HttpStatus.CREATED)
  async generateReminder(
    @Param('appointmentId', ParseIntPipe)
    appointmentId: number,
  ) {
    return this.appointmentReminderService.generateReminderForAppointment(
      appointmentId,
    );
  }

  @Get(':appointmentId')
  @HttpCode(HttpStatus.OK)
  async getReminder(
    @Param('appointmentId', ParseIntPipe)
    appointmentId: number,
  ) {
    return this.appointmentReminderService.getReminderForAppointment(
      appointmentId,
    );
  }
}