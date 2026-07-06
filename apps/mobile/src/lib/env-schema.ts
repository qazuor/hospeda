/**
 * @file env-schema.ts
 * @description Pure, zero-side-effect Zod schema for the mobile app environment.
 *
 * This file MUST import ONLY from `zod`. No `expo-constants` (unsafe under
 * plain Node/tsx — it expects to run inside the Expo runtime), no other app
 * or package imports. That purity is what lets a plain root-level script
 * (`tsx`, no Expo/Metro bundler) safely `import` the real mobile env schema
 * for introspection (HOS-79 — Env Var Management Hardening).
 *
 * `env.ts` re-exports {@link EnvSchema} from here and is responsible for
 * everything with side effects: reading `Constants.expoConfig` (via
 * `expo-constants`) and `process.env`.
 *
 * A guard test (`test/lib/env-schema-purity.guard.test.ts`) asserts this file
 * never re-acquires a non-zod import.
 */
import { z } from 'zod';

/**
 * Shape of the mobile env. Both vars are optional at the schema level; the
 * production requirement is enforced as a cross-field check in `validateEnv`
 * (`env.ts`).
 */
export const EnvSchema = z.object({
    EXPO_PUBLIC_API_URL: z.string().url().optional(),
    EXPO_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).optional()
});
