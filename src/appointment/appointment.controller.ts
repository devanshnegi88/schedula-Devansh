import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from '../appointment/create-appointment.dto';

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
}