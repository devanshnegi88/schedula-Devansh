import { Role } from '../../users/user.entity';

export class SignupDto {
  name: string;
  email: string;
  password: string;
  role: Role;
}