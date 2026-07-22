import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { DoctorService } from '../doctor/doctor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/user.entity';

import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Controller('doctor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Post('profile')
  create(
    @Req() req,
    @Body() dto: CreateDoctorDto,
  ) {
    return this.doctorService.create(req.user.id, dto);
  }

  @Get('profile')
  findOne(@Req() req) {
    return this.doctorService.findOne(req.user.id);
  }

  @Patch('profile')
  update(
    @Req() req,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.doctorService.update(req.user.id, dto);
  }
}