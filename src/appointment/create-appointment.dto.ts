import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateappointmentDto {
  @IsInt()
  doctorId: number;

  @IsInt()
  patientId: number;

  @IsInt()
  availabilityId: number;

  /**
   * Date on which the patient wants to book.
   * Example: 2026-07-27
   */
  @IsDateString()
  appointmentDate: string;

  /**
   * Required only for WAVE scheduling.
   * STREAM scheduling ignores this field.
   * Format: HH:mm
   */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'slotStartTime must be in HH:mm format',
  })
  slotStartTime?: string;
}