import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RecurringAvailability } from './entities/recurring-availability.entity';
import { Doctor } from '../doctor/doctor.entity';

import { RecurringAvailabilityController } from './recurring-availability.controller';
import { RecurringAvailabilityService } from './recurring-availability.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecurringAvailability,
      Doctor,
    ]),
  ],
  controllers: [RecurringAvailabilityController],
  providers: [RecurringAvailabilityService],
  exports: [RecurringAvailabilityService],
})
export class RecurringAvailabilityModule {}