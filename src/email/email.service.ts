import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('SENDGRID_API_KEY');

    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY is not configured');
    }

    sgMail.setApiKey(apiKey);
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('SENDGRID_FROM_EMAIL');

    const fromName =
      this.configService.get<string>('SENDGRID_FROM_NAME') ||
      'Doctor Management System';

    if (!fromEmail) {
      throw new Error(
        'SENDGRID_FROM_EMAIL is not configured',
      );
    }

    try {
      await sgMail.send({
        to,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject,
        html,
      });

      this.logger.log(
        `Email sent to ${
          Array.isArray(to) ? to.join(', ') : to
        }`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }
}