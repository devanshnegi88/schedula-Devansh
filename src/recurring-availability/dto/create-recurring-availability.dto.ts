import {
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

import { Day } from '../../enums/day.enum';
import { SchedulingType } from '../entities/recurring-availability.entity';

export class CreateRecurringAvailabilityDto {
  @IsArray()
@ArrayNotEmpty()
@IsEnum(Day, { each: true })
days: Day[];

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @IsEnum(SchedulingType)
  schedulingType: SchedulingType;

  /**
   * STREAM ONLY
   * Maximum number of patients allowed.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  /**
   * WAVE ONLY
   * Duration of each slot in minutes.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  slotDuration?: number;

  /**
   * WAVE ONLY
   * Gap between slots in minutes.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean = true;
}