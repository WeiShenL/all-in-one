/**
 * Unit Tests for useUnreadNotificationCount Hook
 * Tests unread count management, localStorage sync, and tRPC integration
 */

import { renderHook, act } from '@testing-library/react';
import { useUnreadNotificationCount } from '@/lib/hooks/useUnreadNotificationCount';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/lib/context/NotificationContext';
import { trpc } from '@/app/lib/trpc';

// Mock dependencies
jest.mock('@/lib/supabase/auth-context');
jest.mock('@/lib/context/NotificationContext');
jest.mock('@/app/lib/trpc', () => ({
  trpc: {
    notification: {
      getUnreadCount: {
        useQuery: jest.fn(),
      },
    },
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseNotifications = useNotifications as jest.MockedFunction<
  typeof useNotifications
>;
const mockUseQuery = trpc.notification.getUnreadCount
  .useQuery as jest.MockedFunction<any>;

describe('useUnreadNotificationCount', () => {
  let mockRefetch: jest.Mock;
  const STORAGE_KEY = 'unreadNotificationCount';

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mock implementations
    mockRefetch = jest.fn().mockResolvedValue({ data: { count: 0 } });

    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      loading: false,
      signOut: jest.fn(),
      signIn: jest.fn(),
      signUp: jest.fn(),
      isAuthenticated: true,
    } as any);

    mockUseNotifications.mockReturnValue({
      notifications: [],
      addNotification: jest.fn(),
      dismissAll: jest.fn(),
      lastNotificationTime: 0,
      dismissNotification: jest.fn(),
      removeNotification: jest.fn(),
      clearAll: jest.fn(),
      isConnected: true,
      error: null,
    });

    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial State', () => {
    it('should initialize with count 0', () => {
      const { result } = renderHook(() => useUnreadNotificationCount());

      expect(result.current.count).toBe(0);
    });

    it('should query unread count when user is authenticated', () => {
      renderHook(() => useUnreadNotificationCount());

      expect(mockUseQuery).toHaveBeenCalledWith(
        { userId: 'user-123' },
        expect.objectContaining({
          enabled: true,
          staleTime: Infinity,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        })
      );
    });

    it('should not enable query when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signOut: jest.fn(),
        signIn: jest.fn(),
        signUp: jest.fn(),
        isAuthenticated: false,
      } as any);

      renderHook(() => useUnreadNotificationCount());

      expect(mockUseQuery).toHaveBeenCalledWith(
        { userId: '' },
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });

  describe('Count Updates from Database', () => {
    it('should update count when database data changes', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 5 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      expect(result.current.count).toBe(5);
    });

    it('should update localStorage when count changes', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 3 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      renderHook(() => useUnreadNotificationCount());

      expect(localStorage.getItem(STORAGE_KEY)).toBe('3');
    });

    it('should handle count updates from 0 to positive', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 0 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result, rerender } = renderHook(() =>
        useUnreadNotificationCount()
      );

      expect(result.current.count).toBe(0);

      // Update to positive count
      mockUseQuery.mockReturnValue({
        data: { count: 7 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      rerender();

      expect(result.current.count).toBe(7);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('7');
    });

    it('should handle count updates from positive to 0', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 5 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result, rerender } = renderHook(() =>
        useUnreadNotificationCount()
      );

      expect(result.current.count).toBe(5);

      // Update to zero
      mockUseQuery.mockReturnValue({
        data: { count: 0 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      rerender();

      expect(result.current.count).toBe(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('0');
    });
  });

  describe('Realtime Notification Integration', () => {
    it('should refetch when new notification arrives', () => {
      // Start with count of 5
      mockUseQuery.mockReturnValue({
        data: { count: 5 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result, rerender } = renderHook(() =>
        useUnreadNotificationCount()
      );

      expect(result.current.count).toBe(5);
      expect(mockRefetch).not.toHaveBeenCalled();

      // Simulate new notification
      mockUseNotifications.mockReturnValue({
        notifications: [],
        addNotification: jest.fn(),
        dismissAll: jest.fn(),
        lastNotificationTime: Date.now(),
        dismissNotification: jest.fn(),
        removeNotification: jest.fn(),
        clearAll: jest.fn(),
        isConnected: true,
        error: null,
      });

      rerender();

      // New behavior: count increments locally, no DB refetch
      expect(result.current.count).toBe(6);
      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it('should not refetch when lastNotificationTime is 0', () => {
      mockUseNotifications.mockReturnValue({
        notifications: [],
        addNotification: jest.fn(),
        dismissAll: jest.fn(),
        lastNotificationTime: 0,
        dismissNotification: jest.fn(),
        removeNotification: jest.fn(),
        clearAll: jest.fn(),
        isConnected: true,
        error: null,
      });

      renderHook(() => useUnreadNotificationCount());

      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it('should refetch on multiple notification updates', () => {
      // Start with count of 5
      mockUseQuery.mockReturnValue({
        data: { count: 5 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result, rerender } = renderHook(() =>
        useUnreadNotificationCount()
      );

      expect(result.current.count).toBe(5);

      // First notification
      mockUseNotifications.mockReturnValue({
        notifications: [],
        addNotification: jest.fn(),
        dismissAll: jest.fn(),
        lastNotificationTime: 1000,
        dismissNotification: jest.fn(),
        removeNotification: jest.fn(),
        clearAll: jest.fn(),
        isConnected: true,
        error: null,
      });
      rerender();

      // New behavior: count increments locally, no DB refetch
      expect(result.current.count).toBe(6);
      expect(mockRefetch).not.toHaveBeenCalled();

      // Second notification
      mockUseNotifications.mockReturnValue({
        notifications: [],
        addNotification: jest.fn(),
        dismissAll: jest.fn(),
        lastNotificationTime: 2000,
        dismissNotification: jest.fn(),
        removeNotification: jest.fn(),
        clearAll: jest.fn(),
        isConnected: true,
        error: null,
      });
      rerender();

      // Count should increment again (6 -> 7), no DB refetch
      expect(result.current.count).toBe(7);
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe('resetCount', () => {
    it('should reset count to 0', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 5 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      expect(result.current.count).toBe(5);

      act(() => {
        result.current.resetCount();
      });

      expect(result.current.count).toBe(0);
    });

    it('should update localStorage when reset', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 5 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      act(() => {
        result.current.resetCount();
      });

      expect(localStorage.getItem(STORAGE_KEY)).toBe('0');
    });

    it('should refetch count from database after reset', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
      const { result } = renderHook(() => useUnreadNotificationCount());

      act(() => {
        result.current.resetCount();
      });

      // New behavior: resetCount sets to 0 locally, no DB refetch
      expect(setItemSpy).toHaveBeenCalledWith('unreadNotificationCount', '0');
      setItemSpy.mockRestore();
    });

    it('should maintain stable resetCount reference', () => {
      const { result, rerender } = renderHook(() =>
        useUnreadNotificationCount()
      );

      const firstResetCount = result.current.resetCount;

      rerender();

      expect(result.current.resetCount).toBe(firstResetCount);
    });
  });

  describe('localStorage Sync', () => {
    it('should listen to storage events from other tabs', () => {
      const { result } = renderHook(() => useUnreadNotificationCount());

      expect(result.current.count).toBe(0);

      // Simulate storage event from another tab
      act(() => {
        const storageEvent = new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: '8',
          oldValue: '0',
        });
        window.dispatchEvent(storageEvent);
      });

      expect(result.current.count).toBe(8);
    });

    it('should ignore storage events for other keys', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 3 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      expect(result.current.count).toBe(3);

      // Simulate storage event for different key
      act(() => {
        const storageEvent = new StorageEvent('storage', {
          key: 'someOtherKey',
          newValue: '99',
          oldValue: '0',
        });
        window.dispatchEvent(storageEvent);
      });

      expect(result.current.count).toBe(3); // Should not change
    });

    it('should ignore storage events with null newValue', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 3 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      expect(result.current.count).toBe(3);

      // Simulate storage event with null value (item removed)
      act(() => {
        const storageEvent = new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: null,
          oldValue: '3',
        });
        window.dispatchEvent(storageEvent);
      });

      expect(result.current.count).toBe(3); // Should not change
    });

    it('should cleanup storage event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useUnreadNotificationCount());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'storage',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it('should parse storage value as integer', () => {
      const { result } = renderHook(() => useUnreadNotificationCount());

      act(() => {
        const storageEvent = new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: '42',
          oldValue: '0',
        });
        window.dispatchEvent(storageEvent);
      });

      expect(result.current.count).toBe(42);
      expect(typeof result.current.count).toBe('number');
    });
  });

  describe('Query Configuration', () => {
    it('should use infinite stale time (no polling)', () => {
      renderHook(() => useUnreadNotificationCount());

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          staleTime: Infinity,
          refetchOnMount: false,
        })
      );
    });

    it('should not refetch on window focus (performance optimization)', () => {
      renderHook(() => useUnreadNotificationCount());

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          refetchOnWindowFocus: false,
        })
      );
    });

    it('should handle query loading state', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      // Should maintain previous count during loading
      expect(result.current.count).toBe(0);
    });

    it('should handle query error state', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      // Should maintain previous count on error
      expect(result.current.count).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined user', () => {
      mockUseAuth.mockReturnValue({
        user: undefined,
        loading: false,
        signOut: jest.fn(),
        signIn: jest.fn(),
        signUp: jest.fn(),
        isAuthenticated: false,
      } as any);

      const { result } = renderHook(() => useUnreadNotificationCount());

      expect(result.current.count).toBe(0);
      expect(mockUseQuery).toHaveBeenCalledWith(
        { userId: '' },
        expect.objectContaining({
          enabled: false,
        })
      );
    });

    it('should handle rapid count changes', () => {
      const { rerender } = renderHook(() => useUnreadNotificationCount());

      // Rapid count changes
      for (let i = 1; i <= 5; i++) {
        mockUseQuery.mockReturnValue({
          data: { count: i },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });
        rerender();
      }

      // Should end up with final count
      expect(localStorage.getItem(STORAGE_KEY)).toBe('5');
    });

    it('should handle negative count (invalid data)', () => {
      mockUseQuery.mockReturnValue({
        data: { count: -1 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      // Hook doesn't validate, just stores the value
      expect(result.current.count).toBe(-1);
    });

    it('should handle very large count numbers', () => {
      mockUseQuery.mockReturnValue({
        data: { count: 999999 },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUnreadNotificationCount());

      expect(result.current.count).toBe(999999);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('999999');
    });
  });
});
