// __tests__/simple.test.ts
describe('Basic Tests', () => {
  test('basic math works', () => {
    expect(1 + 1).toBe(2);
  });

  test('string manipulation works', () => {
    const greeting: string = 'Hello';
    expect(`${greeting} World`).toBe('Hello World');
  });
});
