import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { RecurringAvailabilityModule } from './recurring-availability/recurring-availability.module';
import { CustomAvailabilityModule } from './custom-availability/custom-availability.module';
import { AppointmentModule } from './appointment/appointment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow('DATABASE_HOST'),
        port: Number(config.getOrThrow('DATABASE_PORT')),
        username: config.getOrThrow('DATABASE_USER'),
        password: config.getOrThrow('DATABASE_PASSWORD'),
        database: config.getOrThrow('DATABASE_NAME'),

        autoLoadEntities: true,
        synchronize: true,
        logging: true,

        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),

    AuthModule,
    UsersModule,
    DoctorModule,
    PatientModule,
    RecurringAvailabilityModule,
    CustomAvailabilityModule,
    AppointmentModule,
  ],
})
export class AppModule {}