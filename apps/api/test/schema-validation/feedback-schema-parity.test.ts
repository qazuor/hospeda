/**
 * T-006 (SPEC-301) — Feedback schema parity guard.
 *
 * Locks the behavioral contract between the two parallel feedback Zod schemas
 * (risk R-4) so that drift between them is caught immediately.
 *
 * CLIENT SCHEMA: `feedbackFormSchema`  — `@repo/schemas` (Zod v3)
 * API SCHEMA:    `feedbackSubmitSchema` — `apps/api/.../feedback/public/validation.ts` (Zod v4)
 *
 * Tests use `safeParse` accept/reject at boundaries to stay agnostic to the
 * Zod v3 vs v4 internal-API difference. No `._def` comparisons.
 *
 * INTENTIONAL DIFFERENCES (documented here; NOT treated as drift):
 *   1. `attachments`: present in `feedbackFormSchema` (client validates `File[]`),
 *      absent from `feedbackSubmitSchema` (API receives files via FormData separately).
 *   2. `environment` sub-schema: the API `environmentSchema` adds character-count
 *      maximums on several optional sub-fields (locale max(35), sentryEventId max(120),
 *      connectionType max(32), featureFlags values max(500), etc.) that the client
 *      `feedbackEnvironmentSchema` omits. These are intentional API-side tightening
 *      constraints, not shared-field drift.
 *   3. `environment.errorInfo`: API schema adds `max(1000)` on `message` and
 *      `max(5000)` on `stack`; client schema has no explicit max on either.
 *      Both treat the field as optional — no required-status drift.
 *
 * SHARED SCALAR FIELDS TESTED:
 *   type, title, description, reporterEmail, reporterName (all required)
 *   severity, stepsToReproduce, expectedResult, actualResult (all optional)
 *
 * @module test/schema-validation/feedback-schema-parity
 */

import { feedbackFormSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { feedbackSubmitSchema } from '../../src/routes/feedback/public/validation';

// ─── Shared test helpers ──────────────────────────────────────────────────────

/**
 * Minimum valid environment object accepted by BOTH schemas.
 * Only `timestamp` and `appSource` are required; all other env fields are optional.
 */
const VALID_ENV = {
    timestamp: '2024-01-01T00:00:00.000Z',
    appSource: 'web'
} as const;

/**
 * Minimum valid base payload accepted by BOTH schemas.
 *
 * Optional fields (severity, stepsToReproduce, expectedResult, actualResult,
 * attachments) are omitted intentionally so they can be tested in isolation.
 * `title` is exactly 5 chars (min boundary); `description` is 12 chars (≥10);
 * `reporterName` is 2 chars (min boundary).
 */
const BASE_PAYLOAD = {
    type: 'bug-js',
    title: 'Title',
    description: 'Description.',
    reporterEmail: 'reporter@example.com',
    reporterName: 'Jo',
    environment: VALID_ENV
} as const;

/**
 * Parse `payload` with both schemas and return both SafeParseReturn results.
 *
 * Keeping calls symmetric ensures a single test assertion covers both schemas:
 * any drift immediately produces a `client.success !== api.success` mismatch.
 */
function parseBoth(payload: unknown) {
    return {
        client: feedbackFormSchema.safeParse(payload),
        api: feedbackSubmitSchema.safeParse(payload)
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('T-006 SPEC-301 — feedback schema parity guard', () => {
    // ── Baseline ──────────────────────────────────────────────────────────────

    describe('baseline — minimal valid payload', () => {
        it('both schemas accept the minimum valid base payload', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD });

            expect(client.success, 'client feedbackFormSchema baseline').toBe(true);
            expect(api.success, 'api feedbackSubmitSchema baseline').toBe(true);
        });
    });

    // ── type — required enum ──────────────────────────────────────────────────

    describe('type — required enum', () => {
        const VALID_TYPES = [
            'bug-js',
            'bug-ui-ux',
            'bug-content',
            'feature-request',
            'improvement',
            'other'
        ] as const;

        it('both schemas accept every valid type value', () => {
            for (const type of VALID_TYPES) {
                const { client, api } = parseBoth({ ...BASE_PAYLOAD, type });
                expect(client.success, `client should accept type="${type}"`).toBe(true);
                expect(api.success, `api should accept type="${type}"`).toBe(true);
            }
        });

        it('both schemas reject an unknown type value', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, type: 'unknown-type' });
            expect(client.success, 'client should reject unknown type').toBe(false);
            expect(api.success, 'api should reject unknown type').toBe(false);
        });

        it('both schemas reject a missing type field', () => {
            const { type: _type, ...rest } = BASE_PAYLOAD;
            const { client, api } = parseBoth(rest);
            expect(client.success, 'client should reject missing type').toBe(false);
            expect(api.success, 'api should reject missing type').toBe(false);
        });
    });

    // ── title — required, min(5), max(200) ───────────────────────────────────

    describe('title — required, min(5), max(200)', () => {
        it('both schemas accept title at exact min boundary (5 chars)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, title: 'a'.repeat(5) });
            expect(client.success, 'client should accept title at min(5)').toBe(true);
            expect(api.success, 'api should accept title at min(5)').toBe(true);
        });

        it('both schemas accept title at exact max boundary (200 chars)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, title: 'a'.repeat(200) });
            expect(client.success, 'client should accept title at max(200)').toBe(true);
            expect(api.success, 'api should accept title at max(200)').toBe(true);
        });

        it('both schemas reject title one char over max (201 chars)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, title: 'a'.repeat(201) });
            expect(client.success, 'client should reject title over max').toBe(false);
            expect(api.success, 'api should reject title over max').toBe(false);
        });

        it('both schemas reject title one char under min (4 chars)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, title: 'a'.repeat(4) });
            expect(client.success, 'client should reject title under min').toBe(false);
            expect(api.success, 'api should reject title under min').toBe(false);
        });

        it('both schemas reject a missing title field', () => {
            const { title: _title, ...rest } = BASE_PAYLOAD;
            const { client, api } = parseBoth(rest);
            expect(client.success, 'client should reject missing title').toBe(false);
            expect(api.success, 'api should reject missing title').toBe(false);
        });
    });

    // ── description — required, min(10), max(5000) ───────────────────────────

    describe('description — required, min(10), max(5000)', () => {
        it('both schemas accept description at exact min boundary (10 chars)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, description: 'a'.repeat(10) });
            expect(client.success, 'client should accept description at min(10)').toBe(true);
            expect(api.success, 'api should accept description at min(10)').toBe(true);
        });

        it('both schemas accept description at exact max boundary (5000 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                description: 'a'.repeat(5000)
            });
            expect(client.success, 'client should accept description at max(5000)').toBe(true);
            expect(api.success, 'api should accept description at max(5000)').toBe(true);
        });

        it('both schemas reject description one char over max (5001 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                description: 'a'.repeat(5001)
            });
            expect(client.success, 'client should reject description over max').toBe(false);
            expect(api.success, 'api should reject description over max').toBe(false);
        });

        it('both schemas reject description one char under min (9 chars)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, description: 'a'.repeat(9) });
            expect(client.success, 'client should reject description under min').toBe(false);
            expect(api.success, 'api should reject description under min').toBe(false);
        });

        it('both schemas reject a missing description field', () => {
            const { description: _desc, ...rest } = BASE_PAYLOAD;
            const { client, api } = parseBoth(rest);
            expect(client.success, 'client should reject missing description').toBe(false);
            expect(api.success, 'api should reject missing description').toBe(false);
        });
    });

    // ── reporterEmail — required, email format ────────────────────────────────

    describe('reporterEmail — required, email format', () => {
        it('both schemas accept a valid email address', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                reporterEmail: 'user@domain.com'
            });
            expect(client.success, 'client should accept valid email').toBe(true);
            expect(api.success, 'api should accept valid email').toBe(true);
        });

        it('both schemas reject a malformed email address', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                reporterEmail: 'not-an-email'
            });
            expect(client.success, 'client should reject malformed email').toBe(false);
            expect(api.success, 'api should reject malformed email').toBe(false);
        });

        it('both schemas reject a missing reporterEmail field', () => {
            const { reporterEmail: _email, ...rest } = BASE_PAYLOAD;
            const { client, api } = parseBoth(rest);
            expect(client.success, 'client should reject missing reporterEmail').toBe(false);
            expect(api.success, 'api should reject missing reporterEmail').toBe(false);
        });
    });

    // ── reporterName — required, min(2), max(100) ─────────────────────────────

    describe('reporterName — required, min(2), max(100)', () => {
        it('both schemas accept reporterName at exact min boundary (2 chars)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, reporterName: 'ab' });
            expect(client.success, 'client should accept reporterName at min(2)').toBe(true);
            expect(api.success, 'api should accept reporterName at min(2)').toBe(true);
        });

        it('both schemas accept reporterName at exact max boundary (100 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                reporterName: 'a'.repeat(100)
            });
            expect(client.success, 'client should accept reporterName at max(100)').toBe(true);
            expect(api.success, 'api should accept reporterName at max(100)').toBe(true);
        });

        it('both schemas reject reporterName one char over max (101 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                reporterName: 'a'.repeat(101)
            });
            expect(client.success, 'client should reject reporterName over max').toBe(false);
            expect(api.success, 'api should reject reporterName over max').toBe(false);
        });

        it('both schemas reject reporterName one char under min (1 char)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, reporterName: 'a' });
            expect(client.success, 'client should reject reporterName under min').toBe(false);
            expect(api.success, 'api should reject reporterName under min').toBe(false);
        });

        it('both schemas reject a missing reporterName field', () => {
            const { reporterName: _name, ...rest } = BASE_PAYLOAD;
            const { client, api } = parseBoth(rest);
            expect(client.success, 'client should reject missing reporterName').toBe(false);
            expect(api.success, 'api should reject missing reporterName').toBe(false);
        });
    });

    // ── severity — optional enum ──────────────────────────────────────────────

    describe('severity — optional enum', () => {
        const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

        it('both schemas accept the payload without severity (optional field)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD });
            expect(client.success, 'client should accept missing severity').toBe(true);
            expect(api.success, 'api should accept missing severity').toBe(true);
        });

        it('both schemas accept every valid severity value', () => {
            for (const severity of VALID_SEVERITIES) {
                const { client, api } = parseBoth({ ...BASE_PAYLOAD, severity });
                expect(client.success, `client should accept severity="${severity}"`).toBe(true);
                expect(api.success, `api should accept severity="${severity}"`).toBe(true);
            }
        });

        it('both schemas reject an invalid severity value', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD, severity: 'urgent' });
            expect(client.success, 'client should reject invalid severity').toBe(false);
            expect(api.success, 'api should reject invalid severity').toBe(false);
        });
    });

    // ── stepsToReproduce — optional, max(3000) ────────────────────────────────

    describe('stepsToReproduce — optional, max(3000)', () => {
        it('both schemas accept the payload without stepsToReproduce (optional field)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD });
            expect(client.success, 'client should accept missing stepsToReproduce').toBe(true);
            expect(api.success, 'api should accept missing stepsToReproduce').toBe(true);
        });

        it('both schemas accept stepsToReproduce at exact max boundary (3000 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                stepsToReproduce: 'a'.repeat(3000)
            });
            expect(client.success, 'client should accept stepsToReproduce at max(3000)').toBe(true);
            expect(api.success, 'api should accept stepsToReproduce at max(3000)').toBe(true);
        });

        it('both schemas reject stepsToReproduce one char over max (3001 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                stepsToReproduce: 'a'.repeat(3001)
            });
            expect(client.success, 'client should reject stepsToReproduce over max').toBe(false);
            expect(api.success, 'api should reject stepsToReproduce over max').toBe(false);
        });
    });

    // ── expectedResult — optional, max(1000) ──────────────────────────────────

    describe('expectedResult — optional, max(1000)', () => {
        it('both schemas accept the payload without expectedResult (optional field)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD });
            expect(client.success, 'client should accept missing expectedResult').toBe(true);
            expect(api.success, 'api should accept missing expectedResult').toBe(true);
        });

        it('both schemas accept expectedResult at exact max boundary (1000 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                expectedResult: 'a'.repeat(1000)
            });
            expect(client.success, 'client should accept expectedResult at max(1000)').toBe(true);
            expect(api.success, 'api should accept expectedResult at max(1000)').toBe(true);
        });

        it('both schemas reject expectedResult one char over max (1001 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                expectedResult: 'a'.repeat(1001)
            });
            expect(client.success, 'client should reject expectedResult over max').toBe(false);
            expect(api.success, 'api should reject expectedResult over max').toBe(false);
        });
    });

    // ── actualResult — optional, max(1000) ────────────────────────────────────

    describe('actualResult — optional, max(1000)', () => {
        it('both schemas accept the payload without actualResult (optional field)', () => {
            const { client, api } = parseBoth({ ...BASE_PAYLOAD });
            expect(client.success, 'client should accept missing actualResult').toBe(true);
            expect(api.success, 'api should accept missing actualResult').toBe(true);
        });

        it('both schemas accept actualResult at exact max boundary (1000 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                actualResult: 'a'.repeat(1000)
            });
            expect(client.success, 'client should accept actualResult at max(1000)').toBe(true);
            expect(api.success, 'api should accept actualResult at max(1000)').toBe(true);
        });

        it('both schemas reject actualResult one char over max (1001 chars)', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                actualResult: 'a'.repeat(1001)
            });
            expect(client.success, 'client should reject actualResult over max').toBe(false);
            expect(api.success, 'api should reject actualResult over max').toBe(false);
        });
    });

    // ── environment — required sub-object ─────────────────────────────────────

    describe('environment — required sub-object with shared required fields', () => {
        it('both schemas reject a missing environment field', () => {
            const { environment: _env, ...rest } = BASE_PAYLOAD;
            const { client, api } = parseBoth(rest);
            expect(client.success, 'client should reject missing environment').toBe(false);
            expect(api.success, 'api should reject missing environment').toBe(false);
        });

        it('both schemas reject environment without required timestamp', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                environment: { appSource: 'web' }
            });
            expect(client.success, 'client should reject env missing timestamp').toBe(false);
            expect(api.success, 'api should reject env missing timestamp').toBe(false);
        });

        it('both schemas reject environment without required appSource', () => {
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                environment: { timestamp: '2024-01-01T00:00:00.000Z' }
            });
            expect(client.success, 'client should reject env missing appSource').toBe(false);
            expect(api.success, 'api should reject env missing appSource').toBe(false);
        });

        it('both schemas accept all valid appSource values', () => {
            const validSources = ['web', 'admin', 'standalone'] as const;
            for (const appSource of validSources) {
                const { client, api } = parseBoth({
                    ...BASE_PAYLOAD,
                    environment: { ...VALID_ENV, appSource }
                });
                expect(
                    client.success,
                    `client should accept environment.appSource="${appSource}"`
                ).toBe(true);
                expect(api.success, `api should accept environment.appSource="${appSource}"`).toBe(
                    true
                );
            }
        });
    });

    // ── Intentional differences — documented for future maintainers ───────────

    describe('intentional differences — not treated as drift', () => {
        it('base payload (no attachments) is accepted by both schemas', () => {
            // attachments is client-only (validates File[] in the browser).
            // The API receives files separately via FormData.
            // Both schemas accept the base payload that omits attachments.
            const { client, api } = parseBoth({ ...BASE_PAYLOAD });
            expect(client.success).toBe(true);
            expect(api.success).toBe(true);
        });

        it('cfTurnstileToken is accepted by both schemas when present (shared optional field)', () => {
            // cfTurnstileToken is an optional field on both client and API schemas.
            // It flows through the JSON data payload. Both schemas must accept it.
            const { client, api } = parseBoth({
                ...BASE_PAYLOAD,
                cfTurnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'
            });
            expect(client.success, 'client should accept cfTurnstileToken').toBe(true);
            expect(api.success, 'api should accept cfTurnstileToken').toBe(true);
        });

        it('cfTurnstileToken is accepted by both schemas when absent (shared optional field)', () => {
            // Both schemas must also accept the field being absent.
            const { client, api } = parseBoth({ ...BASE_PAYLOAD });
            expect(client.success, 'client should accept absent cfTurnstileToken').toBe(true);
            expect(api.success, 'api should accept absent cfTurnstileToken').toBe(true);
        });
    });
});
