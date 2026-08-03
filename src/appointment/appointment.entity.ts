import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';
import { RecurringAvailability } from '../recurring-availability/entities/recurring-availability.entity';

export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => Doctor,
    (doctor) => doctor.appointments,
    {
      onDelete: 'CASCADE',
    },
  )
  doctor: Doctor;

  @ManyToOne(
    () => Patient,
    (patient) => patient.appointments,
    {
      onDelete: 'CASCADE',
    },
  )
  patient: Patient;

  @ManyToOne(
    () => RecurringAvailability,
    (availability) => availability.appointments,
    {
      onDelete: 'CASCADE',
    },
  )
  recurringAvailability: RecurringAvailability;

  @Column({
    type: 'date',
  })
  appointmentDate: string;

  /**
   * STREAM Scheduling
   * Token assigned in booking order.
   * Null for WAVE appointments.
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  tokenNumber: number | null;

  /**
   * WAVE Scheduling
   * Generated slot start time.
   * Null for STREAM appointments.
   */
  @Column({
    type: 'time',
    nullable: true,
  })
  slotStartTime: string | null;

  /**
   * WAVE Scheduling
   * Generated slot end time.
   * Null for STREAM appointments.
   */
  @Column({
    type: 'time',
    nullable: true,
  })
  slotEndTime: string | null;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.BOOKED,
  })
  status: AppointmentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}