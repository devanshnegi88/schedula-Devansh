import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { appointment } from './appointment.entity';
import { appointmentService } from './appointment.service';
import { appointmentController } from './appointment.controller';

import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';
import { RecurringAvailability } from '../recurring-availability/entities/recurring-availability.entity';
import { CustomAvailability } from '../custom-availability/entities/custom-availability.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      appointment,
      Doctor,
      Patient,
      RecurringAvailability,
      CustomAvailability,
    ]),
  ],
  controllers: [ appointmentController],
  providers: [appointmentService],
  exports: [appointmentService],
})
export class AppointmentModule { }
