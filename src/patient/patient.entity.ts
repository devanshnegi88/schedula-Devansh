import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { Appointment } from '../appointment/appointment.entity';

@Entity()
export class Patient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullName: string;

  @Column()
  age: number;

  @Column()
  gender: string;

  @Column()
  contactDetails: string;

  @Column({ nullable: true })
  healthInformation: string;

  @OneToOne(() => User, (user) => user.patientProfile)
  @JoinColumn()
  user: User;

  @OneToMany(
  () => Appointment,
  (appointment) => appointment.patient,
)
appointments: Appointment[];
}