import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const TEST_USER_EMAIL = 'login-test@example.com';
const TEST_USER_PASSWORD = 'Test123!@#';

describe('Login Integration Tests', () => {
  let supabaseClient: ReturnType<typeof createClient>;
  let pgClient: Client;

  beforeAll(async () => {
    // Initialize Supabase client
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );

    // Initialize PostgreSQL client for direct database operations
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
  });

  afterAll(async () => {
    await pgClient.end();
  });

  beforeEach(async () => {
    // Clean up any existing test user
    await pgClient.query('DELETE FROM public."user_profile" WHERE email = $1', [
      TEST_USER_EMAIL,
    ]);
    await pgClient.query('DELETE FROM auth.users WHERE email = $1', [
      TEST_USER_EMAIL,
    ]);
  });

  afterEach(async () => {
    // Sign out after each test
    await supabaseClient.auth.signOut();

    // Clean up test user
    await pgClient.query('DELETE FROM public."user_profile" WHERE email = $1', [
      TEST_USER_EMAIL,
    ]);
    await pgClient.query('DELETE FROM auth.users WHERE email = $1', [
      TEST_USER_EMAIL,
    ]);
  });

  describe('Successful login', () => {
    it('should login with valid credentials and create user profile', async () => {
      // First, create a test user via signup
      const { data: signupData, error: signupError } =
        await supabaseClient.auth.signUp({
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
        });

      expect(signupError).toBeNull();
      expect(signupData.user).toBeTruthy();

      // Sign out to prepare for login test
      await supabaseClient.auth.signOut();

      // Attempt login
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeNull();
      expect(data.user).toBeTruthy();
      expect(data.user?.email).toBe(TEST_USER_EMAIL);
      expect(data.session).toBeTruthy();
      expect(data.session?.access_token).toBeTruthy();

      // Verify user profile was created via trigger
      const profileResult = await pgClient.query(
        'SELECT * FROM public."user_profile" WHERE email = $1',
        [TEST_USER_EMAIL]
      );

      expect(profileResult.rows.length).toBe(1);
      expect(profileResult.rows[0].email).toBe(TEST_USER_EMAIL);
      expect(profileResult.rows[0].role).toBe('STAFF');
    });

    it('should return session with correct token', async () => {
      // Create test user
      await supabaseClient.auth.signUp({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });
      await supabaseClient.auth.signOut();

      // Login
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.session?.access_token).toBeTruthy();
      expect(data.session?.refresh_token).toBeTruthy();
      expect(data.session?.expires_at).toBeGreaterThan(Date.now() / 1000);
    });

    it('should fetch user profile after login', async () => {
      // Create test user with metadata
      await supabaseClient.auth.signUp({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        options: {
          data: {
            name: 'Test User',
          },
        },
      });
      await supabaseClient.auth.signOut();

      // Login
      const { data: loginData } = await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      // Fetch profile from database
      const profileResult = await pgClient.query(
        'SELECT * FROM public."user_profile" WHERE id = $1',
        [loginData.user?.id]
      );

      expect(profileResult.rows.length).toBe(1);
      expect(profileResult.rows[0].name).toBe('Test User');
      expect(profileResult.rows[0].role).toBe('STAFF');
    });
  });

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
    });

    it('should fail with incorrect password', async () => {
      // Create test user
      await supabaseClient.auth.signUp({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });
      await supabaseClient.auth.signOut();

      // Attempt login with wrong password
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: 'WrongPassword123!',
      });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('Invalid');
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    });

    it('should fail with empty credentials', async () => {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: '',
        password: '',
      });

      expect(error).toBeTruthy();
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    });

    it('should fail with malformed email', async () => {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: 'not-an-email',
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeTruthy();
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    });
  });

  describe('Session management', () => {
    it('should retrieve existing session after login', async () => {
      // Create and login test user
      await supabaseClient.auth.signUp({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });
      await supabaseClient.auth.signOut();
      await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      // Get current session
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      expect(session).toBeTruthy();
      expect(session?.user.email).toBe(TEST_USER_EMAIL);
    });

    it('should not have session before login', async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      expect(session).toBeNull();
    });

    it('should clear session after logout', async () => {
      // Create and login test user
      await supabaseClient.auth.signUp({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });
      await supabaseClient.auth.signOut();
      await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      // Verify session exists
      let {
        data: { session },
      } = await supabaseClient.auth.getSession();
      expect(session).toBeTruthy();

      // Logout
      await supabaseClient.auth.signOut();

      // Verify session is cleared
      ({
        data: { session },
      } = await supabaseClient.auth.getSession());
      expect(session).toBeNull();
    });
  });

  describe('User role assignment', () => {
    it('should assign default STAFF role to new users', async () => {
      await supabaseClient.auth.signUp({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      const profileResult = await pgClient.query(
        'SELECT role FROM public."user_profile" WHERE email = $1',
        [TEST_USER_EMAIL]
      );

      expect(profileResult.rows[0].role).toBe('STAFF');
    });

    it('should maintain role across login sessions', async () => {
      // Create user and update role to MANAGER
      const { data: signupData } = await supabaseClient.auth.signUp({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      await pgClient.query(
        'UPDATE public."user_profile" SET role = $1 WHERE id = $2',
        ['MANAGER', signupData.user?.id]
      );

      await supabaseClient.auth.signOut();

      // Login again
      await supabaseClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      // Check role is still MANAGER
      const profileResult = await pgClient.query(
        'SELECT role FROM public."user_profile" WHERE email = $1',
        [TEST_USER_EMAIL]
      );

      expect(profileResult.rows[0].role).toBe('MANAGER');
    });
  });
});
