import { Resend } from 'resend';

interface EmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export class EmailService {
  private resend: Resend;

  constructor() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not defined in environment variables');
    }
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private handleError(
    error: unknown,
    context: string,
    shouldThrow: boolean = true
  ): void {
    console.error(`[${this.constructor.name}] Error in ${context}:`, error);

    if (shouldThrow) {
      if (error instanceof Error) {
        throw new Error(`${context}: ${error.message}`);
      }
      throw new Error(`${context}: An unknown error occurred`);
    }
  }

  async sendEmail(options: EmailOptions) {
    try {
      const defaultHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${options.subject}</title>
        <style>
          body {
            font-family: sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .header {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            text-align: center;
          }
          .content {
            margin-bottom: 20px;
          }
          .footer {
            font-size: 12px;
            color: #777;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Task Completed</div>
          <div class="content">
            <p>${options.text}</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
      `;
      const { data, error } = await this.resend.emails.send({
        from: process.env.RESEND_EMAIL_FROM || 'onboarding@resend.dev',
        to: options.to,
        subject: options.subject,
        html: options.html || defaultHtml,
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
