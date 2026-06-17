/**
 * Vitest setup for the Hospeda mobile app.
 *
 * Ensures `NODE_ENV=test` so the startup env validation in `src/lib/env.ts`
 * (`validateEnv`) is bypassed during unit tests, which mock `expo-constants`
 * to provide the API URL.
 */
process.env.NODE_ENV = 'test';
