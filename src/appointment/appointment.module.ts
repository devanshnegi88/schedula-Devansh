import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Appointment } from './appointment.entity';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';

import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';
import { RecurringAvailability } from '../recurring-availability/entities/recurring-availability.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Doctor,
      Patient,
      RecurringAvailability,
    ]),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService],
  exports: [AppointmentService],
})
export class AppointmentModule {}
