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
      // ============================================
      // TEST_EMAIL_RECIPIENT Override Logic
      // ============================================
      // For Resend free tier: all emails must go to verified email
      // This overrides the actual recipient but includes original in email body

      let actualRecipient = options.to;
      const testRecipient = process.env.TEST_EMAIL_RECIPIENT;

      // Get original recipient info for debugging
      const originalRecipientInfo = Array.isArray(options.to)
        ? options.to.join(', ')
        : options.to;

      // Override recipient if TEST_EMAIL_RECIPIENT is set
      if (testRecipient && testRecipient.trim() !== '') {
        console.warn('[EmailService] TEST MODE: Overriding email recipient');
        console.warn(`  Original: ${originalRecipientInfo}`);
        console.warn(`  Override: ${testRecipient}`);
        actualRecipient = testRecipient;
      }

      // ============================================
      // Build Email HTML with Debug Info
      // ============================================

      // Debug header for test mode
      const debugHeader =
        testRecipient && testRecipient.trim() !== ''
          ? `<div style="background: #fef3c7; padding: 10px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
             <strong>⚠️ TEST MODE</strong><br>
             <strong>Original Recipient:</strong> ${originalRecipientInfo}
           </div>`
          : '';

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
          ${debugHeader}
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

      // Use provided HTML or default, but inject debug header if in test mode
      let finalHtml = options.html || defaultHtml;

      // If custom HTML provided and in test mode, prepend debug header
      if (options.html && testRecipient && testRecipient.trim() !== '') {
        finalHtml = debugHeader + options.html;
      }

      // ============================================
      // Send Email
      // ============================================

      const { data, error } = await this.resend.emails.send({
        from: process.env.RESEND_EMAIL_FROM || 'onboarding@resend.dev',
        to: actualRecipient, // Use overridden recipient if in test mode
        subject: options.subject,
        html: finalHtml,
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
