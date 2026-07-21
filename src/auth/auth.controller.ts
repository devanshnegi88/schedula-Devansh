import { Body, Controller, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
  ) {}




  @Post('signup')
signup(@Body() dto: SignupDto) {
  console.log('Controller DTO:', dto);
  return this.authService.signup(dto);
}

@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
}