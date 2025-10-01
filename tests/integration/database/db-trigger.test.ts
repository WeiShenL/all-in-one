import { Client } from 'pg';

const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('Postgres trigger for public."user_profile"', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  afterEach(async () => {
    // Clean up test records if they exist
    await client.query('DELETE FROM public."user_profile" WHERE id = $1', [
      TEST_USER_ID,
    ]);
    await client.query('DELETE FROM auth.users WHERE id = $1', [TEST_USER_ID]);
  });

  it('should sync new auth user into public."user_profile"', async () => {
    await client.query(
      `
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES ($1, $2, $3)
    `,
      [TEST_USER_ID, 'trigger-test@example.com', '{"name": "TriggerTest"}']
    );

    const result = await client.query(
      'SELECT * FROM public."user_profile" WHERE id = $1',
      [TEST_USER_ID]
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].email).toBe('trigger-test@example.com');
    expect(result.rows[0].name).toBe('TriggerTest');
    expect(result.rows[0].role).toBe('STAFF');
  });
});
