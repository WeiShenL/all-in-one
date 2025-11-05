/**
 * Integration tests for Realtime Notifications - Multiple Clients
 *
 * These tests verify that multiple Supabase clients can subscribe to the same
 * realtime channel and receive broadcasts from each other.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RealtimeNotification } from '@/types/notification';
import { NotificationType } from '@prisma/client';

// Use actual Supabase instance for integration testing
// Environment variables are loaded by jest.setup.js
const supabaseUrl = process.env.NEXT_PUBLIC_API_EXTERNAL_URL;
const supabaseKey = process.env.NEXT_PUBLIC_ANON_KEY;

// Skip these tests if Supabase credentials are not available (e.g., in CI without secrets)
const describeIfSupabase =
  supabaseUrl && supabaseKey ? describe : describe.skip;

describeIfSupabase('Realtime Notifications - Multiple Clients', () => {
  let client1: SupabaseClient;
  let client2: SupabaseClient;
  let client3: SupabaseClient;

  let channel1: RealtimeChannel;
  let channel2: RealtimeChannel;
  let channel3: RealtimeChannel;

  const receivedMessages = {
    client1: [] as RealtimeNotification[],
    client2: [] as RealtimeNotification[],
    client3: [] as RealtimeNotification[],
  };

  beforeEach(() => {
    // Create three independent Supabase client instances
    client1 = createClient(supabaseUrl!, supabaseKey!);
    client2 = createClient(supabaseUrl!, supabaseKey!);
    client3 = createClient(supabaseUrl!, supabaseKey!);

    // Clear received messages
    receivedMessages.client1 = [];
    receivedMessages.client2 = [];
    receivedMessages.client3 = [];
  });

  afterEach(async () => {
    // Clean up all channels and connections
    if (channel1) {
      await client1.removeChannel(channel1);
    }
    if (channel2) {
      await client2.removeChannel(channel2);
    }
    if (channel3) {
      await client3.removeChannel(channel3);
    }

    await client1.removeAllChannels();
    await client2.removeAllChannels();
    await client3.removeAllChannels();
  });

  describe('Broadcast to Multiple Subscribers', () => {
    test('all clients receive broadcast from client1', async () => {
      // Setup: Subscribe all three clients to the same channel
      const subscriptionPromises = [];

      // Client 1
      const sub1Promise = new Promise<void>(resolve => {
        channel1 = client1
          .channel('notifications-test-1', {
            config: { broadcast: { self: true } },
          })
          .on(
            'broadcast',
            { event: 'notification' },
            (payload: { payload: RealtimeNotification }) => {
              receivedMessages.client1.push(payload.payload);
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
      });

      // Client 2
      const sub2Promise = new Promise<void>(resolve => {
        channel2 = client2
          .channel('notifications-test-1', {
            config: { broadcast: { self: true } },
          })
          .on(
            'broadcast',
            { event: 'notification' },
            (payload: { payload: RealtimeNotification }) => {
              receivedMessages.client2.push(payload.payload);
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
      });

      // Client 3
      const sub3Promise = new Promise<void>(resolve => {
        channel3 = client3
          .channel('notifications-test-1', {
            config: { broadcast: { self: true } },
          })
          .on(
            'broadcast',
            { event: 'notification' },
            (payload: { payload: RealtimeNotification }) => {
              receivedMessages.client3.push(payload.payload);
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
      });

      subscriptionPromises.push(sub1Promise, sub2Promise, sub3Promise);

      // Wait for all subscriptions to be ready
      await Promise.all(subscriptionPromises);

      // Give subscriptions time to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Act: Send broadcast from client1
      const testNotification: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Test Broadcast',
        message: 'Testing multiple client reception',
        broadcast_at: new Date().toISOString(),
        userId: 'test-user-id',
      };

      await channel1.send({
        type: 'broadcast',
        event: 'notification',
        payload: testNotification,
      });

      // Wait for broadcast to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert: All clients should have received the broadcast
      expect(receivedMessages.client1).toHaveLength(1);
      expect(receivedMessages.client2).toHaveLength(1);
      expect(receivedMessages.client3).toHaveLength(1);

      // Verify payload content
      expect(receivedMessages.client1[0].type).toBe(
        NotificationType.TASK_ASSIGNED
      );
      expect(receivedMessages.client1[0].title).toBe('Test Broadcast');
      expect(receivedMessages.client2[0].message).toBe(
        'Testing multiple client reception'
      );
      expect(receivedMessages.client3[0].broadcast_at).toBeDefined();
    }, 60000);

    test('multiple broadcasts reach all clients', async () => {
      // Setup: Subscribe all clients
      const sub1Promise = new Promise<void>(resolve => {
        channel1 = client1
          .channel('notifications-test-2', {
            config: { broadcast: { self: true } },
          })
          .on(
            'broadcast',
            { event: 'notification' },
            (payload: { payload: RealtimeNotification }) => {
              receivedMessages.client1.push(payload.payload);
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
      });

      const sub2Promise = new Promise<void>(resolve => {
        channel2 = client2
          .channel('notifications-test-2', {
            config: { broadcast: { self: true } },
          })
          .on(
            'broadcast',
            { event: 'notification' },
            (payload: { payload: RealtimeNotification }) => {
              receivedMessages.client2.push(payload.payload);
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
      });

      const sub3Promise = new Promise<void>(resolve => {
        channel3 = client3
          .channel('notifications-test-2', {
            config: { broadcast: { self: true } },
          })
          .on(
            'broadcast',
            { event: 'notification' },
            (payload: { payload: RealtimeNotification }) => {
              receivedMessages.client3.push(payload.payload);
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
      });

      await Promise.all([sub1Promise, sub2Promise, sub3Promise]);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Act: Send multiple broadcasts from different clients
      const notification1: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Broadcast 1',
        message: 'From client 1',
        broadcast_at: new Date().toISOString(),
        userId: 'test-user-id',
      };

      const notification2: RealtimeNotification = {
        type: NotificationType.TASK_UPDATED,
        title: 'Broadcast 2',
        message: 'From client 2',
        broadcast_at: new Date().toISOString(),
        userId: 'test-user-id',
      };

      const notification3: RealtimeNotification = {
        type: NotificationType.TASK_OVERDUE,
        title: 'Broadcast 3',
        message: 'From client 3',
        broadcast_at: new Date().toISOString(),
        userId: 'test-user-id',
      };

      await channel1.send({
        type: 'broadcast',
        event: 'notification',
        payload: notification1,
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      await channel2.send({
        type: 'broadcast',
        event: 'notification',
        payload: notification2,
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      await channel3.send({
        type: 'broadcast',
        event: 'notification',
        payload: notification3,
      });

      // Wait for all broadcasts to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert: All clients should have received all 3 broadcasts
      expect(receivedMessages.client1.length).toBeGreaterThanOrEqual(3);
      expect(receivedMessages.client2.length).toBeGreaterThanOrEqual(3);
      expect(receivedMessages.client3.length).toBeGreaterThanOrEqual(3);

      // Verify each client received broadcasts from all sources
      const client1Titles = receivedMessages.client1.map(m => m.title);
      expect(client1Titles).toContain('Broadcast 1');
      expect(client1Titles).toContain('Broadcast 2');
      expect(client1Titles).toContain('Broadcast 3');
    }, 60000);

    test('clients can unsubscribe and no longer receive broadcasts', async () => {
      // Setup: Subscribe all clients
      const sub1Promise = new Promise<void>(resolve => {
        channel1 = client1
          .channel('notifications-test-3', {
            config: { broadcast: { self: true } },
          })
          .on(
            'broadcast',
            { event: 'notification' },
            (payload: { payload: RealtimeNotification }) => {
              receivedMessages.client1.push(payload.payload);
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
      });

      const sub2Promise = new Promise<void>(resolve => {
        channel2 = client2
          .channel('notifications-test-3', {
            config: { broadcast: { self: true } },
          })
          .on(
            'broadcast',
            { event: 'notification' },
            (payload: { payload: RealtimeNotification }) => {
              receivedMessages.client2.push(payload.payload);
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
      });

      await Promise.all([sub1Promise, sub2Promise]);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Act: Send first broadcast
      const notification1: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Before Unsubscribe',
        message: 'Both clients subscribed',
        broadcast_at: new Date().toISOString(),
        userId: 'test-user-id',
      };

      await channel1.send({
        type: 'broadcast',
        event: 'notification',
        payload: notification1,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Unsubscribe client2
      await client2.removeChannel(channel2);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear received messages
      receivedMessages.client1 = [];
      receivedMessages.client2 = [];

      // Send second broadcast after client2 unsubscribed
      const notification2: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'After Unsubscribe',
        message: 'Only client1 subscribed',
        broadcast_at: new Date().toISOString(),
        userId: 'test-user-id',
      };

      await channel1.send({
        type: 'broadcast',
        event: 'notification',
        payload: notification2,
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert: Only client1 should receive the second broadcast
      expect(receivedMessages.client1).toHaveLength(1);
      expect(receivedMessages.client1[0].title).toBe('After Unsubscribe');
      expect(receivedMessages.client2).toHaveLength(0);
    }, 60000);
  });

  describe('Broadcast Error Handling', () => {
    test('should handle broadcast when channel is not initialized', async () => {
      // Try to send without setting up channel
      const uninitializedChannel = client1.channel('uninitialized');

      await expect(
        uninitializedChannel.send({
          type: 'broadcast',
          event: 'notification',
          payload: { message: 'test' },
        })
      ).resolves.toBeDefined(); // Should not throw, but return error status
    }, 60000);

    test('should handle subscription errors gracefully', async () => {
      const errorHandler = jest.fn();

      channel1 = client1
        .channel('error-test')
        .on(
          'broadcast',
          { event: 'notification' },
          (payload: { payload: RealtimeNotification }) => {
            receivedMessages.client1.push(payload.payload);
          }
        )
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            errorHandler(status);
          }
        });

      // Even if subscription has issues, it should be handled
      await new Promise(resolve => setTimeout(resolve, 500));

      // The test passes if no unhandled errors are thrown
      expect(errorHandler).toHaveBeenCalledTimes(0); // Should successfully subscribe
    }, 60000);
  });
});
