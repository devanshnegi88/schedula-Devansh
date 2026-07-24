import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomAvailability } from './entities/custom-availability.entity';
import { Doctor } from '../doctor/doctor.entity';

import { CustomAvailabilityController } from './custom-availability.controller';
import { CustomAvailabilityService } from './custom-availability.service';
import { RecurringAvailability } from '../recurring-availability/entities/recurring-availability.entity';

@Module({
  imports: [
TypeOrmModule.forFeature([
  CustomAvailability,
  RecurringAvailability,
  Doctor,
])
  ],
  controllers: [CustomAvailabilityController],
  providers: [CustomAvailabilityService],
  exports: [CustomAvailabilityService],
})
export class CustomAvailabilityModule {}