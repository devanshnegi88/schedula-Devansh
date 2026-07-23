import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PatientController } from '../patient/patient.controller';
import { PatientService } from '../patient/patient.service';
import { Patient } from '../patient/patient.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, User]),
  ],
  controllers: [PatientController],
  providers: [PatientService],
})
export class PatientModule {}