import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
} from 'typeorm';

import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';
import { RecurringAvailability } from '../recurring-availability/entities/recurring-availability.entity';

@Entity()
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => Doctor,
    { onDelete: 'CASCADE' },
  )
  doctor: Doctor;

  @ManyToOne(
    () => Patient,
    { onDelete: 'CASCADE' },
  )
  patient: Patient;

  @ManyToOne(
    () => RecurringAvailability,
    { onDelete: 'CASCADE' },
  )
  recurringAvailability: RecurringAvailability;

  @Column()
  appointmentDate: string;

 @Column()
slotStartTime: string;

@Column()
slotEndTime: string;

  @Column({
    nullable: true,
  })
  tokenNumber: number;

  @Column({
    default: 'BOOKED',
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}