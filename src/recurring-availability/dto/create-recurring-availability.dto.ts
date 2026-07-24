import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Matches,
} from 'class-validator';

import { Day } from '../../enums/day.enum';
import { SchedulingType } from '../entities/recurring-availability.entity';

export class CreateRecurringAvailabilityDto {
  @IsEnum(Day)
  day: Day;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime: string;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime: string;

  @IsEnum(SchedulingType)
  schedulingType: SchedulingType;

  @IsOptional()
  @IsInt()
  @Min(1)
  slotDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  recurring?: boolean = true;
}