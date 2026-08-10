import {
  Body,
  Controller,
  Delete,
  Get,
  Query,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';


import { RecurringAvailabilityService } from './recurring-availability.service';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
// import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { RecurringAvailabilityResponseDto } from './dto/recurring-availability-response.dto';
import { CustomAvailabilityService } from '../custom-availability/custom-availability.service';
import { CustomAvailabilityResponseDto } from '../custom-availability/dto/custom-availability-response.dto';
import { ShrinkAvailabilityDto } from './dto/shrink-availability.dto';
import { ExpandAvailabilityDto } from './dto/expand-availability.dto';


import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { Role } from '../users/user.entity';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';

@Controller('doctor/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
export class RecurringAvailabilityController {
  constructor(
  private readonly recurringAvailabilityService: RecurringAvailabilityService,
  private readonly customAvailabilityService: CustomAvailabilityService,
) {}

  @Post()
async create(
  @Req() req,
  @Body() dto: CreateRecurringAvailabilityDto,
) {
  const availabilities =
    await this.recurringAvailabilityService.create(
      req.user.id,
      dto,
    );

  return {
    success: true,
    message: 'Availability created successfully',
    data: availabilities.map((availability) =>
      RecurringAvailabilityResponseDto.fromEntity(
        availability,
      ),
    ),
  };
}

  @Get()
  async findAll(@Req() req) {
    const availabilities =
      await this.recurringAvailabilityService.findAll(
        req.user.id,
      );

    return {
      success: true,
      message:
        'Recurring availability fetched successfully',
      data: availabilities.map((availability) =>
        RecurringAvailabilityResponseDto.fromEntity(
          availability,
        ),
      ),
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecurringAvailabilityDto,
  ) {
    const availability =
      await this.recurringAvailabilityService.update(
        id,
        dto,
      );

    return {
      success: true,
      message: 'Availability updated successfully',
      data: RecurringAvailabilityResponseDto.fromEntity(
        availability,
      ),
    };
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.recurringAvailabilityService.remove(
      id,
    );

    return {
      success: true,
      message:
        'Availability deleted successfully',
    };
  }

  @Get('date')
async findByDate(
  @Req() req,
  @Query('date') date: string,
) {
  const result =
    await this.customAvailabilityService.findByDate(
      req.user.id,
      date,
    );

  const mappedAvailability =
    result.source === 'CUSTOM'
      ? result.availability.map((item: any) =>
          CustomAvailabilityResponseDto.fromEntity(item),
        )
      : result.availability.map((item: any) =>
          RecurringAvailabilityResponseDto.fromEntity(item),
        );

  return {
    success: true,
    message: 'Availability fetched successfully',
    data: {
      source: result.source,
      availability: mappedAvailability,
    },
  };
}

  @Get(':id')
async findOne(
  @Param('id', ParseIntPipe) id: number,
) {
  const availability =
    await this.recurringAvailabilityService.findOne(id);

  return {
    success: true,
    message: 'Availability fetched successfully',
    data: RecurringAvailabilityResponseDto.fromEntity(
      availability,
    ),
  };
}



@Patch(':id/shrink')
async shrinkAvailability(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: ShrinkAvailabilityDto,
) {
  const availability =
    await this.recurringAvailabilityService.shrinkAvailability(
      id,
      dto,
    );

  return {
    success: true,
    message: 'Availability shrunk successfully',
    data: RecurringAvailabilityResponseDto.fromEntity(
      availability,
    ),
  };
}

@Patch(':id/expand')
async expandAvailability(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: ExpandAvailabilityDto,
) {
  const availability =
    await this.recurringAvailabilityService.expandAvailability(
      id,
      dto,
    );

  return {
    success: true,
    message: 'Availability expanded successfully',
    data: RecurringAvailabilityResponseDto.fromEntity(
      availability,
    ),
  };
}
}