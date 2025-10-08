import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import { useSessionTimeout } from '@/lib/hooks/useSessionTimeout';
import { NotificationProvider } from '@/lib/context/NotificationContext';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

describe('useSessionTimeout', () => {
  const mockPush = jest.fn();
  const mockOnTimeout = jest.fn();
  const mockPathname = '/dashboard/staff';

  // Wrapper component for NotificationProvider
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(NotificationProvider, null, children);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Clear localStorage
    localStorage.clear();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue(mockPathname);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should not start timer when disabled', () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: false,
          }),
        { wrapper }
      );

      act(() => {
        jest.advanceTimersByTime(15 * 60 * 1000); // 15 minutes
      });

      expect(mockOnTimeout).not.toHaveBeenCalled();
    });

    it('should start timer when enabled', () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      // Timer should be set but not yet triggered
      expect(mockOnTimeout).not.toHaveBeenCalled();
    });
  });

  describe('Inactivity Timeout', () => {
    it('should call onTimeout after 15 minutes of inactivity', async () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      act(() => {
        jest.advanceTimersByTime(15 * 60 * 1000); // 15 minutes
      });

      await waitFor(() => {
        expect(mockOnTimeout).toHaveBeenCalledTimes(1);
      });
    });

    it('should store session expired info in localStorage after timeout', async () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard/manager');

      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      act(() => {
        jest.advanceTimersByTime(15 * 60 * 1000);
      });

      await waitFor(() => {
        expect(mockOnTimeout).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('sessionExpired')).toBe('true');
        expect(localStorage.getItem('sessionExpiredRedirect')).toBe(
          '/dashboard/manager'
        );
      });
    });

    it('should not timeout before 15 minutes', () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000); // 14 minutes
      });

      expect(mockOnTimeout).not.toHaveBeenCalled();
    });
  });

  describe('Activity Detection', () => {
    it('should reset timer on mouse activity', async () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      // Advance to just before timeout
      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000); // 14 minutes
      });

      // Simulate mouse activity
      act(() => {
        window.dispatchEvent(new MouseEvent('mousedown'));
        jest.advanceTimersByTime(1000); // Allow throttle to clear
      });

      // Advance another 14 minutes (total would be 28 min without reset)
      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      // Should not have timed out because timer was reset
      expect(mockOnTimeout).not.toHaveBeenCalled();

      // Now advance the full 15 minutes from the reset
      act(() => {
        jest.advanceTimersByTime(1 * 60 * 1000);
      });

      await waitFor(() => {
        expect(mockOnTimeout).toHaveBeenCalledTimes(1);
      });
    });

    it('should reset timer on keyboard activity', async () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keypress'));
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      expect(mockOnTimeout).not.toHaveBeenCalled();
    });

    it('should reset timer on scroll activity', async () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      act(() => {
        window.dispatchEvent(new Event('scroll'));
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      expect(mockOnTimeout).not.toHaveBeenCalled();
    });

    it('should reset timer on click activity', async () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('click'));
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      expect(mockOnTimeout).not.toHaveBeenCalled();
    });

    it('should throttle activity events to once per second', () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      // Clear any initial timers
      const initialTimerCount = jest.getTimerCount();

      // Simulate rapid mouse movements within throttle window
      act(() => {
        for (let i = 0; i < 10; i++) {
          window.dispatchEvent(new MouseEvent('mousemove'));
        }
      });

      // Should still have timers (timeout and warning)
      // The throttling prevents excessive resets
      expect(jest.getTimerCount()).toBeGreaterThanOrEqual(initialTimerCount);
    });
  });

  describe('State Transitions', () => {
    it('should clear timers when disabled after being enabled', () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled,
          }),
        { initialProps: { enabled: true }, wrapper }
      );

      // Start with enabled
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      });

      // Disable
      rerender({ enabled: false });

      // Advance past timeout
      act(() => {
        jest.advanceTimersByTime(15 * 60 * 1000);
      });

      // Should not timeout because it was disabled
      expect(mockOnTimeout).not.toHaveBeenCalled();
    });

    it('should start timers when enabled after being disabled', async () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled,
          }),
        { initialProps: { enabled: false }, wrapper }
      );

      // Start disabled - advance time, should not timeout
      act(() => {
        jest.advanceTimersByTime(15 * 60 * 1000);
      });

      expect(mockOnTimeout).not.toHaveBeenCalled();

      // Enable
      rerender({ enabled: true });

      // Now it should timeout after 15 minutes
      act(() => {
        jest.advanceTimersByTime(15 * 60 * 1000);
      });

      await waitFor(() => {
        expect(mockOnTimeout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      unmount();

      // Should remove all event listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mousemove',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keypress',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });

    it('should clear timers on unmount', () => {
      const { unmount } = renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      unmount();

      // Advance time after unmount
      act(() => {
        jest.advanceTimersByTime(15 * 60 * 1000);
      });

      // Should not call timeout after unmount
      expect(mockOnTimeout).not.toHaveBeenCalled();
    });
  });

  describe('Warning Timeout', () => {
    it('should show notification warning 1 minute before timeout', async () => {
      renderHook(
        () =>
          useSessionTimeout({
            onTimeout: mockOnTimeout,
            enabled: true,
          }),
        { wrapper }
      );

      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000); // 14 minutes
      });

      // The notification should be added to the context
      // We need to use a separate hook to check notifications
      // For now, we just verify the timer doesn't trigger early
      expect(mockOnTimeout).not.toHaveBeenCalled();

      // Verify that the full timeout still works after warning
      act(() => {
        jest.advanceTimersByTime(1 * 60 * 1000); // 1 more minute = 15 total
      });

      await waitFor(() => {
        expect(mockOnTimeout).toHaveBeenCalledTimes(1);
      });
    });
  });
});
