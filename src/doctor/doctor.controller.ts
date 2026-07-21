// import { Controller } from '@nestjs/common';

// @Controller('doctor')
// export class DoctorController {}
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('doctor')
export class DoctorController {

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile() {
    return {
      message: 'Doctor Profile',
    };
  }
}