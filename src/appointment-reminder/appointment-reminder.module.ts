import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { appointment } from '../appointment/appointment.entity';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../email/email.module';

import { AppointmentReminderService } from './appointment-reminder.service';
import { AppointmentReminderController } from './appointment-reminder.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      appointment,
    ]),
    NotificationModule,
    EmailModule,
  ],

  controllers: [
    AppointmentReminderController,
  ],

  providers: [
    AppointmentReminderService,
  ],
})
export class AppointmentReminderModule {}