import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './create-appointment.dto';

@Controller('appointments')
export class AppointmentController {
  constructor(
    private readonly appointmentService: AppointmentService,
  ) {}

  @Post()
  async bookAppointment(
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentService.bookAppointment(
      dto.doctorId,
      dto.patientId,
      dto.availabilityId,
      dto.appointmentDate,
      dto.slotStartTime,
    );
  }

  @Get()
  async findAll() {
    return this.appointmentService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentService.findOne(id);
  }
}