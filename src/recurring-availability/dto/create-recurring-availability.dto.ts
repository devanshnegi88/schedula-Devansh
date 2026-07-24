import {
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';

import { Day } from '../../enums/day.enum';

export class CreateRecurringAvailabilityDto {
  @IsEnum(Day)
  day: Day;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;
}