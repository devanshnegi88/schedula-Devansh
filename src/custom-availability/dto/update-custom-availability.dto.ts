import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomAvailabilityDto } from './create-custom-availability.dto';

export class UpdateCustomAvailabilityDto extends PartialType(
  CreateCustomAvailabilityDto,
) {}