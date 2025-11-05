/**
 * Unit Tests for useRealtimeNotifications Hook
 * Tests WebSocket connection management, error handling, and broadcast functionality
 */

import { renderHook, act } from '@testing-library/react';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { getRealtimeClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  getRealtimeClient: jest.fn(),
}));

const mockGetRealtimeClient = getRealtimeClient as jest.MockedFunction<
  typeof getRealtimeClient
>;

describe('useRealtimeNotifications', () => {
  let mockChannel: jest.Mocked<RealtimeChannel>;
  let mockSubscribe: jest.Mock;
  let mockOn: jest.Mock;
  let mockSend: jest.Mock;
  let mockRemoveChannel: jest.Mock;
  let subscribeCallback: (status: string) => void;
  let broadcastCallback: (payload: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock channel methods
    mockSend = jest.fn().mockResolvedValue({ ok: true });
    mockOn = jest.fn().mockReturnThis();
    mockSubscribe = jest.fn(callback => {
      subscribeCallback = callback;
      return mockChannel;
    });

    mockChannel = {
      on: mockOn,
      subscribe: mockSubscribe,
      send: mockSend,
    } as any;

    mockRemoveChannel = jest.fn();

    // Mock Supabase client
    mockGetRealtimeClient.mockReturnValue({
      channel: jest.fn().mockReturnValue(mockChannel),
      removeChannel: mockRemoveChannel,
    } as any);

    // Capture broadcast callback
    mockOn.mockImplementation((type, config, callback) => {
      if (type === 'broadcast') {
        broadcastCallback = callback;
      }
      return mockChannel;
    });
  });

  describe('Connection Management', () => {
    it('should initialize with disconnected state', () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should connect to default channel', () => {
      renderHook(() => useRealtimeNotifications());

      expect(mockGetRealtimeClient).toHaveBeenCalled();
      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        'notifications',
        expect.objectContaining({
          config: {
            broadcast: {
              self: false,
            },
          },
        })
      );
    });

    it('should connect to custom channel', () => {
      renderHook(() => useRealtimeNotifications({ channel: 'custom-channel' }));

      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        'custom-channel',
        expect.any(Object)
      );
    });

    it('should connect to user-specific channel when userId provided', () => {
      renderHook(() => useRealtimeNotifications({ userId: 'user-123' }));

      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        'notifications:user-123',
        expect.any(Object)
      );
    });

    it('should set isConnected to true on SUBSCRIBED status', () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      act(() => {
        subscribeCallback('SUBSCRIBED');
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle CHANNEL_ERROR status', () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      act(() => {
        subscribeCallback('CHANNEL_ERROR');
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toEqual(
        new Error('Failed to connect to realtime channel')
      );
    });

    it('should handle TIMED_OUT status', () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      act(() => {
        subscribeCallback('TIMED_OUT');
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toEqual(new Error('Connection timed out'));
    });

    it('should handle CLOSED status', () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      // First connect
      act(() => {
        subscribeCallback('SUBSCRIBED');
      });
      expect(result.current.isConnected).toBe(true);

      // Then close
      act(() => {
        subscribeCallback('CLOSED');
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull(); // No error on clean close
    });

    it('should cleanup channel on unmount', () => {
      const { unmount } = renderHook(() => useRealtimeNotifications());

      unmount();

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should reset connection state on unmount', () => {
      const { result, unmount } = renderHook(() => useRealtimeNotifications());

      act(() => {
        subscribeCallback('SUBSCRIBED');
      });
      expect(result.current.isConnected).toBe(true);

      unmount();

      // Note: Can't test state after unmount, but we verify cleanup was called
      expect(mockRemoveChannel).toHaveBeenCalled();
    });
  });

  describe('Notification Handling', () => {
    it('should call onNotification callback when broadcast received', () => {
      const mockOnNotification = jest.fn();
      const testNotification = {
        id: '1',
        type: 'task_assigned',
        message: 'New task assigned',
        broadcast_at: '2025-11-06T10:00:00Z',
      };

      renderHook(() =>
        useRealtimeNotifications({
          onNotification: mockOnNotification,
        })
      );

      act(() => {
        broadcastCallback({ payload: testNotification });
      });

      expect(mockOnNotification).toHaveBeenCalledWith(testNotification);
    });

    it('should handle broadcast without onNotification callback', () => {
      const testNotification = {
        id: '1',
        type: 'task_assigned',
        message: 'New task assigned',
        broadcast_at: '2025-11-06T10:00:00Z',
      };

      renderHook(() => useRealtimeNotifications());

      // Should not throw
      expect(() => {
        act(() => {
          broadcastCallback({ payload: testNotification });
        });
      }).not.toThrow();
    });

    it('should update onNotification ref when callback changes', () => {
      const firstCallback = jest.fn();
      const secondCallback = jest.fn();
      const testNotification = {
        id: '1',
        type: 'task_assigned',
        message: 'Test',
        broadcast_at: '2025-11-06T10:00:00Z',
      };

      const { rerender } = renderHook(
        ({ callback }) =>
          useRealtimeNotifications({ onNotification: callback }),
        { initialProps: { callback: firstCallback } }
      );

      // Change callback
      rerender({ callback: secondCallback });

      // Trigger broadcast
      act(() => {
        broadcastCallback({ payload: testNotification });
      });

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledWith(testNotification);
    });
  });

  describe('sendBroadcast', () => {
    it('should send broadcast with correct payload', async () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      const notification = {
        type: 'TASK_ASSIGNED' as const,
        title: 'New Task',
        message: 'New task assigned',
        userId: 'user-123',
      };

      await act(async () => {
        await result.current.sendBroadcast(notification);
      });

      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'notification',
        payload: {
          ...notification,
          broadcast_at: expect.any(String),
        },
      });
    });

    it('should have sendBroadcast function available', () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      expect(typeof result.current.sendBroadcast).toBe('function');
    });

    it('should return channel send response', async () => {
      const mockResponse = { ok: true, error: null };
      mockSend.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRealtimeNotifications());

      const response = await act(async () => {
        return await result.current.sendBroadcast({
          type: 'TASK_ASSIGNED',
          title: 'Test',
          message: 'Test',
          userId: 'user-123',
        });
      });

      expect(response).toEqual(mockResponse);
    });

    it('should add broadcast_at timestamp to payload', async () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      const beforeTime = new Date().toISOString();

      await act(async () => {
        await result.current.sendBroadcast({
          type: 'TASK_ASSIGNED',
          title: 'Test',
          message: 'Test',
          userId: 'user-123',
        });
      });

      const afterTime = new Date().toISOString();

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            broadcast_at: expect.any(String),
          }),
        })
      );

      const sentPayload = mockSend.mock.calls[0][0].payload;
      expect(sentPayload.broadcast_at >= beforeTime).toBe(true);
      expect(sentPayload.broadcast_at <= afterTime).toBe(true);
    });
  });

  describe('Channel Reconnection', () => {
    it('should recreate channel when userId changes', () => {
      const { rerender } = renderHook(
        ({ userId }) => useRealtimeNotifications({ userId }),
        { initialProps: { userId: 'user-1' } }
      );

      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        'notifications:user-1',
        expect.any(Object)
      );

      // Change userId
      rerender({ userId: 'user-2' });

      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        'notifications:user-2',
        expect.any(Object)
      );
      expect(mockRemoveChannel).toHaveBeenCalled();
    });

    it('should recreate channel when channel name changes', () => {
      const { rerender } = renderHook(
        ({ channel }) => useRealtimeNotifications({ channel }),
        { initialProps: { channel: 'channel-1' } }
      );

      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        'channel-1',
        expect.any(Object)
      );

      // Change channel
      rerender({ channel: 'channel-2' });

      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        'channel-2',
        expect.any(Object)
      );
      expect(mockRemoveChannel).toHaveBeenCalled();
    });

    it('should respect autoReconnect option in dependency array', () => {
      const mockChannelFn = jest.fn().mockReturnValue(mockChannel);
      mockGetRealtimeClient.mockReturnValue({
        channel: mockChannelFn,
        removeChannel: mockRemoveChannel,
      } as any);

      const { rerender } = renderHook(
        ({ autoReconnect }) => useRealtimeNotifications({ autoReconnect }),
        { initialProps: { autoReconnect: true } }
      );

      const firstCallCount = mockChannelFn.mock.calls.length;

      // Change autoReconnect
      rerender({ autoReconnect: false });

      // Channel should be recreated
      expect(mockChannelFn.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined options', () => {
      const { result } = renderHook(() => useRealtimeNotifications(undefined));

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle empty options object', () => {
      renderHook(() => useRealtimeNotifications({}));

      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        'notifications',
        expect.any(Object)
      );
    });

    it('should handle multiple status changes', () => {
      const { result } = renderHook(() => useRealtimeNotifications());

      // Connect
      act(() => {
        subscribeCallback('SUBSCRIBED');
      });
      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBeNull();

      // Error
      act(() => {
        subscribeCallback('CHANNEL_ERROR');
      });
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeTruthy();

      // Reconnect
      act(() => {
        subscribeCallback('SUBSCRIBED');
      });
      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should configure broadcast to not receive self', () => {
      renderHook(() => useRealtimeNotifications());

      expect(mockGetRealtimeClient().channel).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          config: {
            broadcast: {
              self: false,
            },
          },
        })
      );
    });
  });
});
