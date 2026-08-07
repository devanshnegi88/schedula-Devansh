import { RecurringAvailability } from '../entities/recurring-availability.entity';

export class RecurringAvailabilityResponseDto {
  id: number;
  day: string;
  startTime: string;
  endTime: string;

  schedulingType: string;

  capacity: number | null;

  slotDuration: number | null;

  bufferTime: number | null;

  recurring: boolean;

  doctorId: number;

  createdAt: Date;

  updatedAt: Date;

  slots?: any[];

  static fromEntity(
    availability: any,
  ): RecurringAvailabilityResponseDto {

    return {
      id: availability.id,

      day: availability.day,

      startTime: availability.startTime,

      endTime: availability.endTime,

      schedulingType:
        availability.schedulingType,

      capacity:
        availability.capacity,

      slotDuration:
        availability.slotDuration,

      bufferTime:
        availability.bufferTime,

      recurring:
        availability.recurring,

      doctorId:
        availability.doctor?.id,

      createdAt:
        availability.createdAt,

      updatedAt:
        availability.updatedAt,

      slots:
        availability.slots,
    };

  }
}