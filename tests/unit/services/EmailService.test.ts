import { EmailService } from '../../../src/app/server/services/EmailService';
import { Resend } from 'resend';

// Mock the Resend SDK
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest
        .fn()
        .mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockResendSend: jest.Mock;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test_api_key';
    process.env.RESEND_EMAIL_FROM = 'test@example.com';
    emailService = new EmailService();
    mockResendSend = (Resend as jest.Mock).mock.results[0].value.emails.send;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_EMAIL_FROM;
  });

  it('should send an email successfully', async () => {
    const options = {
      to: 'recipient@example.com',
      subject: 'Test Subject',
      text: 'Test Text',
    };

    const result = await emailService.sendEmail(options);

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend).toHaveBeenCalledWith({
      from: 'test@example.com',
      to: options.to,
      subject: options.subject,
      html: `<p>${options.text}</p>`,
    });
    expect(result).toEqual({ id: 'mock-email-id' });
  });

  it('should log an error if email sending fails', async () => {
    const errorMessage = 'Failed to send email';
    mockResendSend.mockResolvedValueOnce({
      data: null,
      error: new Error(errorMessage),
    });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const options = {
      to: 'recipient@example.com',
      subject: 'Test Subject',
      text: 'Test Text',
    };

    const result = await emailService.sendEmail(options);

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[EmailService] Error in sendEmail:',
      expect.any(Error)
    );
    expect(result).toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('should throw an error if RESEND_API_KEY is not defined', () => {
    delete process.env.RESEND_API_KEY;
    expect(() => new EmailService()).toThrow(
      'RESEND_API_KEY is not defined in environment variables'
    );
  });
});
