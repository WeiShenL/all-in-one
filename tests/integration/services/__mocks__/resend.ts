export const Resend = jest.fn().mockImplementation(() => ({
  emails: {
    send: jest.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
  },
}));
