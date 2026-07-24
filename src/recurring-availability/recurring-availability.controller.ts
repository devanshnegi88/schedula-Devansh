import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { RecurringAvailabilityService } from './recurring-availability.service';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { RecurringAvailabilityResponseDto } from './dto/recurring-availability-response.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { Role } from '../users/user.entity';

@Controller('doctor/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
export class RecurringAvailabilityController {
  constructor(
    private readonly recurringAvailabilityService: RecurringAvailabilityService,
  ) {}

  @Post()
  async create(
    @Req() req,
    @Body() dto: CreateRecurringAvailabilityDto,
  ) {
    const entity = await this.recurringAvailabilityService.create(
      req.user.id,
      dto,
    );
    
    return {
      success: true,
      message: 'Availability created successfully',
      data: RecurringAvailabilityResponseDto.fromEntity(entity),
    };
  }

  @Get()
  async findAll(@Req() req) {
    const entities = await this.recurringAvailabilityService.findAll(
      req.user.id,
    );
    
    return {
      success: true,
      message: 'Recurring availability fetched successfully',
      data: entities.map((entity) => RecurringAvailabilityResponseDto.fromEntity(entity)),
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecurringAvailabilityDto,
  ) {
    const entity = await this.recurringAvailabilityService.update(
      id,
      dto,
    );
    
    return {
      success: true,
      message: 'Availability updated successfully',
      data: RecurringAvailabilityResponseDto.fromEntity(entity),
    };
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.recurringAvailabilityService.remove(id);
    
    return {
      success: true,
      message: 'Availability deleted successfully',
    };
  }
}