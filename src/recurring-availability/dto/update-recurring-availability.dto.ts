import { PartialType } from '@nestjs/mapped-types';
import { CreateRecurringAvailabilityDto } from './create-recurring-availability.dto';

export class UpdateRecurringAvailabilityDto extends PartialType(
  CreateRecurringAvailabilityDto,
) {}