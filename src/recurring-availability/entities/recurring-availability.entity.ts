import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';

import { Doctor } from '../../doctor/doctor.entity';
import { Day } from '../../enums/day.enum';
import { Appointment } from '../../appointment/appointment.entity';

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

  @Column({
    type: 'int',
    nullable: true,
  })
  slotDuration?: number;

  @Column({
    type: 'int',
    default: 0,
  })
  bufferTime: number;

  @Column({
    type: 'int',
    nullable: true,
  })
  capacity?: number;

  @Column({
    default: true,
  })
  recurring: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(
  () => Appointment,
  (appointment) => appointment.recurringAvailability,
)
appointments: Appointment[];
}