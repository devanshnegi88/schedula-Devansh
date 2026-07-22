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

    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Convert role to uppercase to match the Postgres enum 'DOCTOR' / 'PATIENT'
    const role = dto.role ? (dto.role.toUpperCase() as any) : undefined;

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
      ...(role && { role }),
    });

    return {
      message: 'User registered successfully',
      user,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

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
  access_token: this.jwtService.sign(payload),
};
}
}
