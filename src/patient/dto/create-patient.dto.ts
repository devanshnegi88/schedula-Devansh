import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsNumber()
  age: number;

  @IsString()
  gender: string;

  @IsString()
  contactDetails: string;

  @IsOptional()
  @IsString()
  healthInformation?: string;
}