import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RecurringAvailability } from './entities/recurring-availability.entity';
import { Doctor } from '../doctor/doctor.entity';

import { RecurringAvailabilityController } from './recurring-availability.controller';
import { RecurringAvailabilityService } from './recurring-availability.service';
import { CustomAvailabilityModule } from '../custom-availability/custom-availability.module';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecurringAvailability,
      Doctor,
    ]),
    CustomAvailabilityModule,
    AppointmentModule,
  ],
  controllers: [RecurringAvailabilityController],
  providers: [RecurringAvailabilityService],
})
export class RecurringAvailabilityModule {}