// reschedule-appointment.dto.ts

import {
    IsEnum,
    IsOptional,
    IsString,
    IsNumber,
} from 'class-validator';


export class RescheduleappointmentDto {


    @IsNumber()
    availabilityId: number;

    @IsString()
    appointmentDate: string;

    @IsOptional()
    @IsString()
    slotStartTime?: string;
}