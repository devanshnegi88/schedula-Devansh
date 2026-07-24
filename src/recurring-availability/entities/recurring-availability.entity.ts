import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Doctor } from '../../doctor/doctor.entity';
import { Day } from '../../enums/day.enum';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}