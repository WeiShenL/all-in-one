import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskFileUpload } from '@/app/components/TaskFileUpload';
import { useAuth } from '@/lib/supabase/auth-context';

// Mock useAuth hook
jest.mock('@/lib/supabase/auth-context', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('TaskFileUpload Component', () => {
  const mockUserProfile = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'STAFF' as const,
    departmentId: 'dept-1',
  };

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      userProfile: mockUserProfile,
      user: { id: 'user-123' },
      loading: false,
    });

    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render file upload section', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { data: { files: [], totalSize: 0, count: 0 } },
        }),
      });

      render(<TaskFileUpload taskId='task-123' />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Choose File/i)).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<TaskFileUpload taskId='task-123' />);

      expect(screen.getByText(/Loading files.../i)).toBeInTheDocument();
    });

    it('should show no files message when empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { data: { files: [], totalSize: 0, count: 0 } },
        }),
      });

      render(<TaskFileUpload taskId='task-123' />);

      await waitFor(() => {
        expect(screen.getByText(/No files uploaded yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Storage Usage Display', () => {
    it('should display storage usage indicator', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { data: { files: [], totalSize: 5 * 1024 * 1024, count: 0 } },
        }),
      });

      render(<TaskFileUpload taskId='task-123' />);

      await waitFor(() => {
        expect(screen.getByText(/Storage Usage:/i)).toBeInTheDocument();
        expect(screen.getByText(/5.00 MB \/ 50 MB/i)).toBeInTheDocument();
      });
    });
  });

  describe('File Upload', () => {
    it('should show upload button when file is selected', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { data: { files: [], totalSize: 0, count: 0 } },
        }),
      });

      render(<TaskFileUpload taskId='task-123' />);

      await waitFor(() => {
        expect(screen.getByText(/No files uploaded yet/i)).toBeInTheDocument();
      });

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByLabelText(/Choose File/i) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/test.pdf/i)).toBeInTheDocument();
      });
    });

    it('should reject files over 10MB', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { data: { files: [], totalSize: 0, count: 0 } },
        }),
      });

      render(<TaskFileUpload taskId='task-123' />);

      await waitFor(() => {
        expect(screen.getByText(/No files uploaded yet/i)).toBeInTheDocument();
      });

      // Create file larger than 10MB
      const largeFile = new File(
        [new ArrayBuffer(11 * 1024 * 1024)],
        'large.pdf',
        {
          type: 'application/pdf',
        }
      );
      const input = screen.getByLabelText(/Choose File/i) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(
          screen.getByText(/File size exceeds 10MB limit/i)
        ).toBeInTheDocument();
      });
    });

    it('should reject invalid file types', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { data: { files: [], totalSize: 0, count: 0 } },
        }),
      });

      render(<TaskFileUpload taskId='task-123' />);

      await waitFor(() => {
        expect(screen.getByText(/No files uploaded yet/i)).toBeInTheDocument();
      });

      const invalidFile = new File(['test'], 'script.exe', {
        type: 'application/x-msdownload',
      });
      const input = screen.getByLabelText(/Choose File/i) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText(/File type.*not allowed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on upload failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { data: { files: [], totalSize: 0, count: 0 } },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            error: { message: 'Upload failed' },
          }),
        });

      render(<TaskFileUpload taskId='task-123' />);

      await waitFor(() => {
        expect(screen.getByText(/No files uploaded yet/i)).toBeInTheDocument();
      });

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByLabelText(/Choose File/i) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      // Wait for file to be selected and upload button to appear
      await waitFor(() => {
        expect(screen.getByText(/test.pdf/i)).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', {
        name: /Uploading|Upload/i,
      });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
      });
    });
  });
});
