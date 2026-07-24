import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

import { User } from '../users/user.entity';
import { RecurringAvailability } from '../recurring-availability/entities/recurring-availability.entity';
import { CustomAvailability } from '../custom-availability/entities/custom-availability.entity';

@Entity()
export class Doctor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullName: string;

  @Column()
  specialization: string;

  @Column()
  experience: number;

  @Column()
  qualification: string;

  @Column('decimal')
  consultationFee: number;

  @Column()
  availability: string;

  @Column({ nullable: true })
  profileDetails: string;

  @OneToOne(() => User, (user) => user.doctorProfile)
  @JoinColumn()
  user: User;

  @OneToMany(
  () => RecurringAvailability,
  (availability) => availability.doctor,
)
recurringAvailability: RecurringAvailability[];

@OneToMany(
  () => CustomAvailability,
  (availability) => availability.doctor,
)
customAvailability: CustomAvailability[];
}