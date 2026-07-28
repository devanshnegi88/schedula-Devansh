import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { Doctor } from '../../doctor/doctor.entity';
import { Appointment } from '../../appointment/appointment.entity';
import { Day } from '../../enums/day.enum';

export enum SchedulingType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

@Entity('recurring_availability')
export class RecurringAvailability {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => Doctor,
    (doctor) => doctor.recurringAvailability,
    {
      onDelete: 'CASCADE',
    },
  )
  doctor: Doctor;

  @Column({
    type: 'enum',
    enum: Day,
  })
  day: Day;

  @Column({
    type: 'time',
  })
  startTime: string;

  @Column({
    type: 'time',
  })
  endTime: string;

  @Column({
    type: 'enum',
    enum: SchedulingType,
  })
  schedulingType: SchedulingType;

  /**
   * STREAM ONLY
   * Maximum number of patients that can book
   * this appointment window.
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  capacity: number | null;

  /**
   * WAVE ONLY
   * Duration of each appointment slot (minutes).
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  slotDuration: number | null;

  /**
   * WAVE ONLY
   * Gap between consecutive slots (minutes).
   */
  @Column({
    type: 'int',
    default: 0,
  })
  bufferTime: number;

  @Column({
    default: true,
  })
  recurring: boolean;

  @OneToMany(
    () => Appointment,
    (appointment) => appointment.recurringAvailability,
  )
  appointments: Appointment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}