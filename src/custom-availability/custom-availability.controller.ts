import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { Role } from '../users/user.entity';

import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { CustomAvailabilityService } from './custom-availability.service';
import { CustomAvailabilityResponseDto } from './dto/custom-availability-response.dto';
import { RecurringAvailabilityResponseDto } from '../recurring-availability/dto/recurring-availability-response.dto';

@Controller('doctor/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
export class CustomAvailabilityController {
  constructor(
    private readonly service: CustomAvailabilityService,
  ) {}

  @Post('override')
  async create(
    @Req() req,
    @Body() dto: CreateCustomAvailabilityDto,
  ) {
    const entity = await this.service.create(
      req.user.id,
      dto,
    );
    
    return {
      success: true,
      message: 'Custom availability created successfully',
      data: CustomAvailabilityResponseDto.fromEntity(entity),
    };
  }

  @Get('date')
  async findByDate(
    @Req() req,
    @Query('date') date: string,
  ) {
    const result = await this.service.findByDate(
      req.user.id,
      date,
    );
    
    const mappedAvailability = result.source === 'CUSTOM'
      ? result.availability.map((item: any) => CustomAvailabilityResponseDto.fromEntity(item))
      : result.availability.map((item: any) => RecurringAvailabilityResponseDto.fromEntity(item));

    return {
      success: true,
      message: 'Availability fetched successfully',
      data: {
        source: result.source,
        availability: mappedAvailability,
      },
    };
  }
}