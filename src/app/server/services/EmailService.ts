import { Resend } from 'resend';
import { BaseService } from './BaseService';

interface EmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export class EmailService extends BaseService {
  private resend: Resend;

  constructor() {
    super();
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not defined in environment variables');
    }
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmail(options: EmailOptions) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.RESEND_EMAIL_FROM || 'onboarding@resend.dev',
        to: options.to,
        subject: options.subject,
        html: options.html || `<p>${options.text}</p>`,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    } catch (error) {
      this.handleError(error, 'sendEmail', false);
    }
  }
}
