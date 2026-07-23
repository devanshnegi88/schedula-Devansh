import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Doctor } from '../../doctor/doctor.entity';

@Entity('custom_availability')
export class CustomAvailability {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => Doctor,
    (doctor) => doctor.customAvailability,
    {
      onDelete: 'CASCADE',
    },
  )
  doctor: Doctor;

  @Column({
    type: 'date',
  })
  date: string;

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