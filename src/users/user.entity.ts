import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';

import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';

export enum Role {
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.PATIENT,
  })
  role: Role;

  @OneToOne(() => Doctor, (doctor) => doctor.user)
  doctorProfile: Doctor;

  @OneToOne(() => Patient, (patient) => patient.user)
  patientProfile: Patient;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}