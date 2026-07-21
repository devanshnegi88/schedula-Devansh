import { Injectable } from '@nestjs/common';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  private users: User[] = [];

  create(user: User) {
    user.id = this.users.length + 1;
    this.users.push(user);
    return user;
  }

  findByEmail(email: string) {
    return this.users.find((user) => user.email === email);
  }

  findAll() {
    return this.users;
  }
}