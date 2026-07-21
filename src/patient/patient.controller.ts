// import { Controller } from '@nestjs/common';

// @Controller('patient')
// export class PatientController {}
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('patient')
export class PatientController {
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile() {
    return {
      message: 'Patient Profile',
    };
  }
}