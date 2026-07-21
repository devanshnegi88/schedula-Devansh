import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException } from '@nestjs/common';

import { SignupDto } from './dto/signup.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

async signup(dto: SignupDto) {

  if (!dto || !dto.email || !dto.password) {
    throw new BadRequestException('Please provide all required fields (email, password, etc.)');
  }

  const existingUser = this.usersService.findByEmail(dto.email);

  if (existingUser) {
    throw new BadRequestException('Email already exists');
  }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.usersService.create({
      ...dto,
      password: hashedPassword,
      id: 0,
    });

    return {
      message: 'User registered successfully',
      user,
    };
  }

  async login(dto: LoginDto) {
  const user = this.usersService.findByEmail(dto.email);

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(dto.password, user.password);

  if (!isMatch) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return {
    access_token: await this.jwtService.signAsync(payload),
  };
}
}