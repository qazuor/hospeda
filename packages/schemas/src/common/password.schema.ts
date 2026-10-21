import { z } from 'zod';

/**
 * Regex pattern for strong password validation.
 *
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one ASCII symbol (one of the 32 ASCII punctuation and symbol characters)
 */
/** Matches any of the 32 ASCII punctuation and symbol characters. */
export const AsciiSpecialCharacterRegex = /[!-/:-@[-`{-~]/;

export const StrongPasswordRegex = new RegExp(
    `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*${AsciiSpecialCharacterRegex.source})[\\s\\S]{8,}$`
);

/**
 * Strong password Zod schema.
 *
 * Validates that a password meets the platform security requirements:
 * minimum 8 characters, at least one uppercase letter, one lowercase letter,
 * one digit, and one ASCII symbol from the 32 ASCII punctuation and symbol characters.
 *
 * Maximum length is capped at 128 characters to prevent DoS via large inputs.
 *
 * Use this schema as the single source of truth for password validation
 * across the entire monorepo (API, admin, web).
 *
 * @example
 * ```ts
 * // Valid passwords
 * StrongPasswordSchema.parse('SecureP@ss1');   // ok
 * StrongPasswordSchema.parse('MyP@ssw0rd!');   // ok
 *
 * // Invalid passwords
 * StrongPasswordSchema.parse('short1A!');       // fails: too short if < 8 chars
 * StrongPasswordSchema.parse('nouppercase1!');  // fails: no uppercase
 * StrongPasswordSchema.parse('NOLOWERCASE1!');  // fails: no lowercase
 * StrongPasswordSchema.parse('NoDigits!@AB');   // fails: no digit
 * StrongPasswordSchema.parse('NoSpecial1AB');   // fails: no special char
 * ```
 */
export const StrongPasswordSchema = z
    .string({ message: 'zodError.common.password.required' })
    .min(8, { message: 'zodError.common.password.min' })
    .max(128, { message: 'zodError.common.password.max' })
    .regex(StrongPasswordRegex, { message: 'zodError.common.password.pattern' });

export type StrongPassword = z.infer<typeof StrongPasswordSchema>;
