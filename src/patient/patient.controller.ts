import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PatientService } from '../patient/patient.service'; 
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/user.entity';

import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Controller('patient')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PATIENT)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post('profile')
  create(
    @Req() req,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientService.create(req.user.id, dto);
  }

  @Get('profile')
  findOne(@Req() req) {
    return this.patientService.findOne(req.user.id);
  }

  @Patch('profile')
  update(
    @Req() req,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientService.update(req.user.id, dto);
  }
}