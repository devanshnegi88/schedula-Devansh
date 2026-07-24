import {
  IsInt,
  IsString,
  IsOptional,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsInt()
  doctorId: number;

  @IsInt()
  patientId: number;

  @IsInt()
  availabilityId: number;

  @IsString()
  appointmentDate: string;

  @IsOptional()
  @IsString()
  slotStartTime?: string;
}