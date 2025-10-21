import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

// Define metadata type instead of using `any`
interface UserMetadata {
  name?: string;
  [key: string]: string | number | boolean | undefined;
}

describe('Login Integration Tests', () => {
  let supabaseClient: ReturnType<typeof createClient>;
  let pgClient: Client;
  const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

  // Unique namespace for this test run to prevent parallel conflicts
  const testNamespace = `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const TEST_USER_EMAIL = `login-test.${testNamespace}@example.com`;
  const TEST_USER_PASSWORD = 'Test123!@#';

  if (!serviceRoleKey) {
    throw new Error('SERVICE_ROLE_KEY is required for integration tests');
  }

  beforeAll(async () => {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );

    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
  });

  afterAll(async () => {
    await pgClient.end();
  });

  beforeEach(async () => {
    // Clean up any existing test data with namespace
    await pgClient.query(
      'DELETE FROM public."user_profile" WHERE email LIKE $1',
      [`%.${testNamespace}@%`]
    );
    await pgClient.query('DELETE FROM auth.users WHERE email LIKE $1', [
      `%.${testNamespace}@%`,
    ]);
  });

  afterEach(async () => {
    await supabaseClient.auth.signOut();
    // Clean up test data with namespace
    await pgClient.query(
      'DELETE FROM public."user_profile" WHERE email LIKE $1',
      [`%.${testNamespace}@%`]
    );
    await pgClient.query('DELETE FROM auth.users WHERE email LIKE $1', [
      `%.${testNamespace}@%`,
    ]);
  });

  // -----------------------------
  // Helper to create test user
  // -----------------------------
  async function createTestUser(
    email: string,
    password: string,
    metadata?: UserMetadata
  ) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      serviceRoleKey! // non-null assertion
    );

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      throw error;
    }
    return data.user!;
  }

  // -----------------------------
  // Successful login tests
  // -----------------------------
  describe('Successful login', () => {
    it('should login with valid credentials and create user profile', async () => {
      const user = await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeNull();
      expect(data.user).toBeTruthy();
      expect(data.user?.email).toBe(TEST_USER_EMAIL);
      expect(data.session).toBeTruthy();
      expect(data.session?.access_token).toBeTruthy();

      const profileResult = await pgClient.query(
        'SELECT * FROM public."user_profile" WHERE id = $1',
        [user.id]
      );

      expect(profileResult.rows.length).toBe(1);
      expect(profileResult.rows[0].email).toBe(TEST_USER_EMAIL);
      expect(profileResult.rows[0].role).toBe('STAFF');
    }, 25000);

    it('should return session with correct token', async () => {
      await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.session?.access_token).toBeTruthy();
      expect(data.session?.refresh_token).toBeTruthy();
      expect(data.session?.expires_at).toBeGreaterThan(Date.now() / 1000);
    }, 25000);

    it('should fetch user profile after login', async () => {
      const user = await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD, {
        name: 'Test User',
      });

      await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      const profileResult = await pgClient.query(
        'SELECT * FROM public."user_profile" WHERE id = $1',
        [user.id]
      );

      expect(profileResult.rows.length).toBe(1);
      expect(profileResult.rows[0].name).toBe('Test User');
      expect(profileResult.rows[0].role).toBe('STAFF');
    }, 25000);
  });

  // -----------------------------
  // Failed login attempts
  // -----------------------------
  describe('Failed login attempts', () => {
    it('should fail with invalid email', async () => {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: 'nonexistent@example.com',
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('Invalid');
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    }, 25000);

    it('should fail with incorrect password', async () => {
      await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: 'WrongPassword123!',
      });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('Invalid');
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    }, 25000);

    it('should fail with empty credentials', async () => {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: '',
        password: '',
      });

      expect(error).toBeTruthy();
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    }, 25000);

    it('should fail with malformed email', async () => {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: 'not-an-email',
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeTruthy();
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    }, 25000);
  });

  // -----------------------------
  // Session management
  // -----------------------------
  describe('Session management', () => {
    it('should retrieve existing session after login', async () => {
      await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);

      await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      expect(session).toBeTruthy();
      expect(session?.user.email).toBe(TEST_USER_EMAIL);
    }, 25000);

    it('should not have session before login', async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      expect(session).toBeNull();
    }, 25000);

    it('should clear session after logout', async () => {
      await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);

      await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      let {
        data: { session },
      } = await supabaseClient.auth.getSession();
      expect(session).toBeTruthy();

      await supabaseClient.auth.signOut();

      ({
        data: { session },
      } = await supabaseClient.auth.getSession());
      expect(session).toBeNull();
    }, 25000);
  });

  // -----------------------------
  // User role assignment
  // -----------------------------
  describe('User role assignment', () => {
    it('should assign default STAFF role to new users', async () => {
      const user = await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);

      const profileResult = await pgClient.query(
        'SELECT role FROM public."user_profile" WHERE id = $1',
        [user.id]
      );

      expect(profileResult.rows[0].role).toBe('STAFF');
    }, 25000);

    it('should maintain role across login sessions', async () => {
      const user = await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);

      await pgClient.query(
        'UPDATE public."user_profile" SET role = $1 WHERE id = $2',
        ['MANAGER', user.id]
      );

      await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      const profileResult = await pgClient.query(
        'SELECT role FROM public."user_profile" WHERE id = $1',
        [user.id]
      );

      expect(profileResult.rows[0].role).toBe('MANAGER');
    }, 25000);
  });
});
