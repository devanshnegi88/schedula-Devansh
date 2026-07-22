import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  specialization: string;

  @IsNumber()
  experience: number;

  @IsString()
  qualification: string;

  @IsNumber()
  consultationFee: number;

  @IsString()
  availability: string;

  @IsOptional()
  @IsString()
  profileDetails?: string;
}