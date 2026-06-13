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

    describe('JWT redaction', () => {
        it('redacts a realistic JWT token', () => {
            // Arrange — a well-formed header.payload.signature JWT.
            const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQ';
            // Act
            const result = redactSensitiveData(`token: ${jwt}`);
            // Assert
            expect(result).toBe('token: [REDACTED]');
        });

        it('redacts a JWT embedded in a longer log line', () => {
            // Arrange
            const jwt =
                'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk';
            // Act
            const result = redactSensitiveData(`Incoming Authorization header: Bearer ${jwt}`);
            // Assert — the JWT segment inside the Bearer value is redacted.
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('eyJ');
        });

        // ReDoS regression — `eyJ` repeated with no `.` separators is the
        // adversarial input. With an unbounded run the global-flag regex re-scans
        // the full tail at every `eyJ` offset (O(n^2)): 20 000 repetitions took
        // ~12 s with the unbounded form. The bounded {1,2048} run caps each
        // attempt to a constant, so the same input finishes in well under the
        // 1 s budget even on slow CI.
        it('stays linear on adversarial input of 20 000 "eyJ" repetitions (ReDoS guard)', () => {
            // Arrange
            const input = 'eyJ'.repeat(20_000);
            // Act
            const start = performance.now();
            redactSensitiveData(input);
            const elapsedMs = performance.now() - start;
            // Assert — bounded quantifier keeps total work well under threshold.
            expect(elapsedMs).toBeLessThan(1000);
        });
    });
});
