import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { NotificationType } from './notification-type.enum';

@Entity('notifications')
@Index(
  ['appointmentId', 'eventId'],
  { unique: true },
)
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  patientId: number;

  @Column()
  appointmentId: number;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column()
  eventId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
  default: false,
})
isRead: boolean;
}