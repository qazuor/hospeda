/**
 * Unit tests for `redactSensitiveData`, focused on the sensitive-pattern
 * redaction (emails, tokens, PII) and its ReDoS safety.
 *
 * The email pattern previously used `[A-Za-z0-9.-]+\.[...]`, which backtracked
 * polynomially on inputs like `a@a.a.a...` (CodeQL js/polynomial-redos). Since
 * `redactSensitiveData` runs on every logged value — including attacker-
 * influenced strings — a slow regex there is a real DoS vector.
 */

import { describe, expect, it } from 'vitest';
import { redactSensitiveData } from '../src/redact.js';

describe('redactSensitiveData', () => {
    describe('email redaction', () => {
        it('redacts a simple email', () => {
            expect(redactSensitiveData('contact me at user@example.com please')).toBe(
                'contact me at [REDACTED] please'
            );
        });

        it('redacts an email with a multi-label domain', () => {
            expect(redactSensitiveData('a.b+tag@sub.example.co.uk')).toBe('[REDACTED]');
        });

        it('leaves a string without PII untouched', () => {
            expect(redactSensitiveData('just a normal log line')).toBe('just a normal log line');
        });
    });

    describe('ReDoS safety', () => {
        it('returns quickly on adversarial email-like input (no polynomial backtracking)', () => {
            // Arrange — the input that drove the old email regex to seconds.
            const input = `a@${'a.'.repeat(20000)}`;
            // Act
            const start = process.hrtime.bigint();
            redactSensitiveData(input);
            const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
            // Assert — linear regex stays well under a second even on slow CI.
            expect(elapsedMs).toBeLessThan(1000);
        });
    });

    describe('other sensitive patterns still redact', () => {
        it('redacts a Bearer token', () => {
            expect(redactSensitiveData('Authorization: Bearer abc123def456')).toContain(
                '[REDACTED]'
            );
        });

        it('redacts a value under a sensitive key', () => {
            expect(redactSensitiveData('hunter2', 'password')).toBe('[REDACTED]');
        });
    });
});
