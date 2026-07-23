import { RecurringAvailability } from '../entities/recurring-availability.entity';

export class RecurringAvailabilityResponseDto {
  id: number;
  day: string;
  startTime: string;
  endTime: string;

  static fromEntity(entity: RecurringAvailability): RecurringAvailabilityResponseDto {
    return {
      id: entity.id,
      day: entity.day,
      startTime: typeof entity.startTime === 'string' ? entity.startTime.substring(0, 5) : entity.startTime,
      endTime: typeof entity.endTime === 'string' ? entity.endTime.substring(0, 5) : entity.endTime,
    };
  }
}
