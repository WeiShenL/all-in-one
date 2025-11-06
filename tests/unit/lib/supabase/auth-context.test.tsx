/**
 * Unit Tests for Auth Context
 *
 * Tests the AuthProvider and useAuth hook, including:
 * - User authentication state management
 * - Sign in, sign up, sign out functionality
 * - Password change
 * - Profile fetching and refreshing
 * - Session management
 * - Auth state change handling
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

// Mock the Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

// Mock the session timeout hook
jest.mock('@/lib/hooks/useSessionTimeout', () => ({
  useSessionTimeout: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Auth Context', () => {
  let mockSupabase: any;
  let mockAuthStateChangeCallback: (
    event: AuthChangeEvent,
    session: Session | null
  ) => void;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
  };

  const mockUserProfile = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'STAFF' as const,
    departmentId: 'dept-1',
    isHRAdmin: false,
  };

  const mockSession: Session = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
    token_type: 'bearer',
    user: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getSession: jest.fn(),
        onAuthStateChange: jest.fn(),
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        updateUser: jest.fn(),
      },
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Capture the auth state change callback
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback: any) => {
      mockAuthStateChangeCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      };
    });

    // Default mock for fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          data: mockUserProfile,
        },
      }),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('AuthProvider Initialization', () => {
    it('should initialize with no session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const TestComponent = () => {
        const { user, loading } = useAuth();
        return (
          <div>
            <div data-testid='loading'>{loading ? 'loading' : 'loaded'}</div>
            <div data-testid='user'>
              {user ? 'authenticated' : 'unauthenticated'}
            </div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('unauthenticated');
    });

    it('should initialize with existing session and fetch user profile', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const TestComponent = () => {
        const { user, userProfile, loading } = useAuth();
        return (
          <div>
            <div data-testid='loading'>{loading ? 'loading' : 'loaded'}</div>
            <div data-testid='user'>{user?.email || 'none'}</div>
            <div data-testid='profile'>{userProfile?.name || 'none'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile')).toHaveTextContent('Test User');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('userProfile.getById')
      );
    });

    it('should handle initialization error gracefully', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(
        new Error('Network error')
      );

      const TestComponent = () => {
        const { user, loading } = useAuth();
        return (
          <div>
            <div data-testid='loading'>{loading ? 'loading' : 'loaded'}</div>
            <div data-testid='user'>
              {user ? 'authenticated' : 'unauthenticated'}
            </div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('unauthenticated');
    });

    it('should handle profile fetch failure during initialization', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Profile not found' }),
      });

      const TestComponent = () => {
        const { user, userProfile, loading } = useAuth();
        return (
          <div>
            <div data-testid='loading'>{loading ? 'loading' : 'loaded'}</div>
            <div data-testid='user'>{user?.email || 'none'}</div>
            <div data-testid='profile'>{userProfile?.name || 'none'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      // User should still be set even if profile fetch fails
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile')).toHaveTextContent('none');
    });
  });

  describe('Auth State Changes', () => {
    it('should update state on SIGNED_IN event', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const TestComponent = () => {
        const { user, userProfile } = useAuth();
        return (
          <div>
            <div data-testid='user'>{user?.email || 'none'}</div>
            <div data-testid='profile'>{userProfile?.name || 'none'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('none');
      });

      // Trigger SIGNED_IN event
      await mockAuthStateChangeCallback('SIGNED_IN', mockSession);

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(
          'test@example.com'
        );
        expect(screen.getByTestId('profile')).toHaveTextContent('Test User');
      });
    });

    it('should update state on SIGNED_OUT event', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const TestComponent = () => {
        const { user, userProfile } = useAuth();
        return (
          <div>
            <div data-testid='user'>{user?.email || 'none'}</div>
            <div data-testid='profile'>{userProfile?.name || 'none'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(
          'test@example.com'
        );
      });

      // Trigger SIGNED_OUT event
      await mockAuthStateChangeCallback('SIGNED_OUT', null);

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('none');
        expect(screen.getByTestId('profile')).toHaveTextContent('none');
      });
    });

    it('should handle TOKEN_REFRESHED event', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const TestComponent = () => {
        const { session } = useAuth();
        return <div data-testid='session'>{session ? 'active' : 'none'}</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('session')).toHaveTextContent('active');
      });

      const newSession = { ...mockSession, access_token: 'new-token' };
      await mockAuthStateChangeCallback('TOKEN_REFRESHED', newSession);

      await waitFor(() => {
        expect(screen.getByTestId('session')).toHaveTextContent('active');
      });
    });
  });

  describe('Sign In', () => {
    it('should sign in successfully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const TestComponent = () => {
        const { signIn } = useAuth();
        return (
          <button onClick={() => signIn('test@example.com', 'password')}>
            Sign In
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument();
      });

      screen.getByText('Sign In').click();

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password',
        });
      });
    });

    it('should handle sign in error', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const signInError = new Error('Invalid credentials');
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: signInError,
      });

      const TestComponent = () => {
        const { signIn } = useAuth();
        const [error, setError] = React.useState<any>(null);

        const handleSignIn = async () => {
          const result = await signIn('test@example.com', 'wrong-password');
          setError(result.error);
        };

        return (
          <div>
            <button onClick={handleSignIn}>Sign In</button>
            {error && <div data-testid='error'>{error.message}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument();
      });

      screen.getByText('Sign In').click();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Invalid credentials'
        );
      });
    });

    it('should handle sign in exception', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockRejectedValue(
        new Error('Network error')
      );

      const TestComponent = () => {
        const { signIn } = useAuth();
        const [error, setError] = React.useState<any>(null);

        const handleSignIn = async () => {
          const result = await signIn('test@example.com', 'password');
          setError(result.error);
        };

        return (
          <div>
            <button onClick={handleSignIn}>Sign In</button>
            {error && <div data-testid='error'>{error.message}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument();
      });

      screen.getByText('Sign In').click();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });
    });
  });

  describe('Sign Up', () => {
    it('should sign up successfully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      const TestComponent = () => {
        const { signUp } = useAuth();
        return (
          <button
            onClick={() =>
              signUp('new@example.com', 'password123', {
                name: 'New User',
                departmentId: 'dept-1',
              })
            }
          >
            Sign Up
          </button>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign Up')).toBeInTheDocument();
      });

      screen.getByText('Sign Up').click();

      await waitFor(() => {
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'new@example.com',
          password: 'password123',
          options: {
            emailRedirectTo: expect.stringContaining('/auth/callback'),
            data: {
              name: 'New User',
              departmentId: 'dept-1',
            },
          },
        });
      });
    });

    it('should handle sign up error', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const signUpError = new Error('Email already exists');
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: signUpError,
      });

      const TestComponent = () => {
        const { signUp } = useAuth();
        const [error, setError] = React.useState<any>(null);

        const handleSignUp = async () => {
          const result = await signUp('existing@example.com', 'password');
          setError(result.error);
        };

        return (
          <div>
            <button onClick={handleSignUp}>Sign Up</button>
            {error && <div data-testid='error'>{error.message}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign Up')).toBeInTheDocument();
      });

      screen.getByText('Sign Up').click();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Email already exists'
        );
      });
    });

    it('should handle sign up exception', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabase.auth.signUp.mockRejectedValue(new Error('Network error'));

      const TestComponent = () => {
        const { signUp } = useAuth();
        const [error, setError] = React.useState<any>(null);

        const handleSignUp = async () => {
          const result = await signUp('new@example.com', 'password');
          setError(result.error);
        };

        return (
          <div>
            <button onClick={handleSignUp}>Sign Up</button>
            {error && <div data-testid='error'>{error.message}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign Up')).toBeInTheDocument();
      });

      screen.getByText('Sign Up').click();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });
    });
  });

  describe('Sign Out', () => {
    it('should sign out successfully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.auth.signOut.mockResolvedValue({
        error: null,
      });

      const TestComponent = () => {
        const { signOut, user } = useAuth();
        return (
          <div>
            <div data-testid='user'>{user?.email || 'none'}</div>
            <button onClick={signOut}>Sign Out</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(
          'test@example.com'
        );
      });

      screen.getByText('Sign Out').click();

      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
        expect(screen.getByTestId('user')).toHaveTextContent('none');
      });
    });

    it('should handle sign out error', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const signOutError = new Error('Sign out failed');
      mockSupabase.auth.signOut.mockResolvedValue({
        error: signOutError,
      });

      const TestComponent = () => {
        const { signOut } = useAuth();
        const [error, setError] = React.useState<any>(null);

        const handleSignOut = async () => {
          const result = await signOut();
          setError(result.error);
        };

        return (
          <div>
            <button onClick={handleSignOut}>Sign Out</button>
            {error && <div data-testid='error'>{error.message}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
      });

      screen.getByText('Sign Out').click();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Sign out failed'
        );
      });
    });

    it('should handle sign out exception', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.auth.signOut.mockRejectedValue(new Error('Network error'));

      const TestComponent = () => {
        const { signOut } = useAuth();
        const [error, setError] = React.useState<any>(null);

        const handleSignOut = async () => {
          const result = await signOut();
          setError(result.error);
        };

        return (
          <div>
            <button onClick={handleSignOut}>Sign Out</button>
            {error && <div data-testid='error'>{error.message}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
      });

      screen.getByText('Sign Out').click();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });
    });
  });

  describe('Change Password', () => {
    it('should change password successfully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const TestComponent = () => {
        const { changePassword } = useAuth();
        const [success, setSuccess] = React.useState(false);

        const handleChange = async () => {
          const result = await changePassword('newPassword123');
          if (!result.error) {
            setSuccess(true);
          }
        };

        return (
          <div>
            <button onClick={handleChange}>Change Password</button>
            {success && <div data-testid='success'>Password changed</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Change Password')).toBeInTheDocument();
      });

      screen.getByText('Change Password').click();

      await waitFor(() => {
        expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
          password: 'newPassword123',
        });
        expect(screen.getByTestId('success')).toBeInTheDocument();
      });
    });

    it('should handle change password error', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const passwordError = new Error('Password too weak');
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: passwordError,
      });

      const TestComponent = () => {
        const { changePassword } = useAuth();
        const [error, setError] = React.useState<any>(null);

        const handleChange = async () => {
          const result = await changePassword('weak');
          setError(result.error);
        };

        return (
          <div>
            <button onClick={handleChange}>Change Password</button>
            {error && <div data-testid='error'>{error.message}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Change Password')).toBeInTheDocument();
      });

      screen.getByText('Change Password').click();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Password too weak'
        );
      });
    });

    it('should handle change password exception', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.auth.updateUser.mockRejectedValue(
        new Error('Network error')
      );

      const TestComponent = () => {
        const { changePassword } = useAuth();
        const [error, setError] = React.useState<any>(null);

        const handleChange = async () => {
          const result = await changePassword('newPassword123');
          setError(result.error);
        };

        return (
          <div>
            <button onClick={handleChange}>Change Password</button>
            {error && <div data-testid='error'>{error.message}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Change Password')).toBeInTheDocument();
      });

      screen.getByText('Change Password').click();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });
    });
  });

  describe('Refresh Profile', () => {
    it('should refresh user profile', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const updatedProfile = {
        ...mockUserProfile,
        name: 'Updated Name',
      };

      const TestComponent = () => {
        const { refreshProfile, userProfile } = useAuth();
        const [refreshCount, setRefreshCount] = React.useState(0);

        const handleRefresh = async () => {
          // Change the mock response for next fetch
          (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              result: { data: updatedProfile },
            }),
          });

          await refreshProfile();
          setRefreshCount(c => c + 1);
        };

        return (
          <div>
            <div data-testid='profile'>{userProfile?.name || 'none'}</div>
            <div data-testid='refresh-count'>{refreshCount}</div>
            <button onClick={handleRefresh}>Refresh</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Test User');
      });

      screen.getByText('Refresh').click();

      await waitFor(() => {
        expect(screen.getByTestId('refresh-count')).toHaveTextContent('1');
      });
    });

    it('should not refresh profile when user is not logged in', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const TestComponent = () => {
        const { refreshProfile, user } = useAuth();

        return (
          <div>
            <div data-testid='user'>{user ? 'logged-in' : 'logged-out'}</div>
            <button onClick={refreshProfile}>Refresh</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('logged-out');
      });

      const initialFetchCount = (global.fetch as jest.Mock).mock.calls.length;
      screen.getByText('Refresh').click();

      await waitFor(() => {
        // Should not make additional fetch calls
        expect((global.fetch as jest.Mock).mock.calls.length).toBe(
          initialFetchCount
        );
      });
    });
  });

  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const TestComponent = () => {
        useAuth();
        return <div>Test</div>;
      };

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });

    it('should provide auth context values', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const TestComponent = () => {
        const auth = useAuth();
        return (
          <div>
            <div data-testid='user'>{auth.user?.email || 'none'}</div>
            <div data-testid='profile'>{auth.userProfile?.name || 'none'}</div>
            <div data-testid='role'>{auth.userRole || 'none'}</div>
            <div data-testid='session'>{auth.session ? 'active' : 'none'}</div>
            <div data-testid='loading'>
              {auth.loading ? 'loading' : 'loaded'}
            </div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile')).toHaveTextContent('Test User');
      expect(screen.getByTestId('role')).toHaveTextContent('STAFF');
      expect(screen.getByTestId('session')).toHaveTextContent('active');
    });
  });

  describe('Profile Fetch Error Handling', () => {
    it('should handle fetch exception when fetching profile', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const TestComponent = () => {
        const { user, userProfile, loading } = useAuth();
        return (
          <div>
            <div data-testid='loading'>{loading ? 'loading' : 'loaded'}</div>
            <div data-testid='user'>{user?.email || 'none'}</div>
            <div data-testid='profile'>{userProfile?.name || 'none'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
      });

      // User should still be set even if profile fetch fails
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile')).toHaveTextContent('none');
    });
  });
});
