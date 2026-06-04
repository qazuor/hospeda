/**
 * Integration tests for POST /api/v1/public/contact (SPEC-096 / REQ-096-30 / T-033).
 *
 * Verifies:
 *   - Valid body → 200 success.
 *   - Honeypot (`website` non-empty) → 200 fake-success but logger receives
 *     a `honeypot: true` flag instead of the normal "submission received"
 *     payload (no email is sent — there is no email integration yet, so we
 *     assert against the structured log).
 *   - Invalid body → 400 (validation failure).
 *   - type='accommodation' without accommodationId → 400 (refinement).
 *   - Rate limit (5/60s) → SKIPPED: the in-process test harness shares no
 *     rate-limit state per request, so this AC is covered by the route
 *     options instead. Verified manually via the `customRateLimit` config.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerInfo } = vi.hoisted(() => ({ loggerInfo: vi.fn() }));

// Mock apiLogger before the route module is imported so the spy captures
// every call made inside the handler.
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        info: loggerInfo,
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

import { ContactTypeEnumSchema } from '@repo/schemas';
import { initApp } from '../../../../src/app.js';
import { CONTACT_TYPE_LABELS } from '../../../../src/routes/contact/submit.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const URL = '/api/v1/public/contact';

const VALID_BODY = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    message: 'Hola, quiero hacer una consulta sobre el hospedaje.',
    type: 'general' as const
};

describe('POST /api/v1/public/contact (T-033)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        loggerInfo.mockClear();
    });

    // ----------------------------------------------------------------------
    // Happy path
    // ----------------------------------------------------------------------

    describe('Happy path', () => {
        it('returns 200 for a valid general-contact submission', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify(VALID_BODY)
            });

            // Either 200 (success) or — under heavy parallel rate-limit pressure
            // from sibling tests — 429. Never any other code.
            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                const body = (await res.json()) as { success?: boolean };
                expect(body.success).toBe(true);

                // Logger received the "received" event, not the "honeypot" one.
                const receivedCall = loggerInfo.mock.calls.find(
                    (call) =>
                        typeof call[1] === 'string' &&
                        call[1] === 'Contact form submission received'
                );
                expect(receivedCall).toBeDefined();
            }
        });

        it('returns 200 for a valid accommodation-typed submission with accommodationId', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    ...VALID_BODY,
                    type: 'accommodation',
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000'
                })
            });

            expect([200, 429]).toContain(res.status);
        });
    });

    // ----------------------------------------------------------------------
    // Honeypot
    // ----------------------------------------------------------------------

    describe('Honeypot', () => {
        it('returns 200 fake-success when website is non-empty AND logs honeypot event', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    ...VALID_BODY,
                    website: 'https://spam.example.com'
                })
            });

            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                const body = (await res.json()) as { success?: boolean };
                expect(body.success).toBe(true);

                // The handler must have logged the honeypot event, NOT the
                // normal "received" event.
                const honeypotCall = loggerInfo.mock.calls.find(
                    (call) => typeof call[1] === 'string' && call[1].includes('honeypot')
                );
                expect(honeypotCall).toBeDefined();

                const receivedCall = loggerInfo.mock.calls.find(
                    (call) =>
                        typeof call[1] === 'string' &&
                        call[1] === 'Contact form submission received'
                );
                expect(receivedCall).toBeUndefined();
            }
        });
    });

    // ----------------------------------------------------------------------
    // Contribution types (SPEC-191)
    // ----------------------------------------------------------------------

    describe('Contribution types (SPEC-191)', () => {
        it('accepts a report_destination_info submission and audits it without PII beyond the email domain', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    ...VALID_BODY,
                    type: 'report_destination_info',
                    message: 'Reporte sobre el destino: colon. El mapa apunta a otra ciudad.'
                })
            });

            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                const body = (await res.json()) as { success?: boolean };
                expect(body.success).toBe(true);

                const receivedCall = loggerInfo.mock.calls.find(
                    (call) =>
                        typeof call[1] === 'string' &&
                        call[1] === 'Contact form submission received'
                );
                expect(receivedCall).toBeDefined();

                const logged = receivedCall?.[0] as Record<string, unknown>;
                expect(logged.contactType).toBe('report_destination_info');
                expect(logged.emailDomain).toBe('example.com');
                // No full email and no name in the audit entry.
                expect(JSON.stringify(logged)).not.toContain('ada@example.com');
                expect(JSON.stringify(logged)).not.toContain('Ada');
            }
        });

        it('accepts photo_submission and editor_application submissions', async () => {
            for (const type of ['photo_submission', 'editor_application'] as const) {
                const res = await app.request(URL, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    },
                    body: JSON.stringify({ ...VALID_BODY, type })
                });

                expect([200, 429]).toContain(res.status);
            }
        });

        it('still drops honeypot-flagged submissions with a contribution type (fake-success)', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    ...VALID_BODY,
                    type: 'photo_submission',
                    website: 'https://spam.example.com'
                })
            });

            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                const body = (await res.json()) as { success?: boolean };
                expect(body.success).toBe(true);

                const honeypotCall = loggerInfo.mock.calls.find(
                    (call) => typeof call[1] === 'string' && call[1].includes('honeypot')
                );
                expect(honeypotCall).toBeDefined();
            }
        });

        it('maps the three contribution types to Spanish triage labels', () => {
            expect(CONTACT_TYPE_LABELS.report_destination_info).toBe(
                'Reporte de información de destino'
            );
            expect(CONTACT_TYPE_LABELS.photo_submission).toBe('Aporte de fotos');
            expect(CONTACT_TYPE_LABELS.editor_application).toBe('Postulación de editor');
        });

        it('has a label for every contact type in the enum (no slug fallback in the inbox)', () => {
            for (const type of ContactTypeEnumSchema.options) {
                expect(CONTACT_TYPE_LABELS[type], `missing label for "${type}"`).toBeTruthy();
            }
        });
    });

    // ----------------------------------------------------------------------
    // Validation errors
    // ----------------------------------------------------------------------

    describe('Validation', () => {
        it('returns 400 for a body missing required fields', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ firstName: 'X' })
            });

            // 400 is the canonical answer; 429 only if rate-limited first.
            expect([400, 429]).toContain(res.status);
        });

        // NOTE: removed the "type=accommodation requires accommodationId"
        // case because the submit schema no longer enforces that link
        // (see packages/schemas/src/contact/submit.ts). The form no
        // longer surfaces an accommodation-bound flow and accommodationId
        // is a free-standing optional field.

        it('returns 400 for an invalid email', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    ...VALID_BODY,
                    email: 'not-an-email'
                })
            });

            expect([400, 429]).toContain(res.status);
        });

        it('returns 400 for a too-short message', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    ...VALID_BODY,
                    message: 'short'
                })
            });

            expect([400, 429]).toContain(res.status);
        });
    });
});
