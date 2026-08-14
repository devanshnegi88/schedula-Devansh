import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Notification } from './notification.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

import { Patient } from '../patient/patient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      Patient,
    ]),
  ],

  controllers: [
    NotificationController,
  ],

  providers: [
    NotificationService,
  ],

  exports: [
    NotificationService,
  ],
})
export class NotificationModule {}