import { CustomAvailability } from '../entities/custom-availability.entity';

export class CustomAvailabilityResponseDto {
  id: number;
  date: string;
  startTime: string;
  endTime: string;

  static fromEntity(entity: CustomAvailability): CustomAvailabilityResponseDto {
    return {
      id: entity.id,
      date: entity.date,
      startTime: typeof entity.startTime === 'string' ? entity.startTime.substring(0, 5) : entity.startTime,
      endTime: typeof entity.endTime === 'string' ? entity.endTime.substring(0, 5) : entity.endTime,
    };
  }
}
