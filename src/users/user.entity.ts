export enum Role {
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}

export class User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: Role;
}