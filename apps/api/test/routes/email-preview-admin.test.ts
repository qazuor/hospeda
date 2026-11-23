/**
 * HOS-2519 US-5: the admin email preview endpoints, through the real app.
 *
 * AC-5.1 401 guest / 403 without the permission / 200 with a body that parses,
 * AC-5.2 400 VALIDATION_ERROR for a bad query and 404 NOT_FOUND for an unknown
 * key or scenario, AC-5.3 500 INTERNAL_ERROR that never echoes the cause and
 * logs key + scenario, AC-5.4 total and catalog order.
 */

import { EMAIL_CATALOG } from '@repo/notifications';
import { EmailPreviewListResponseSchema, EmailPreviewRenderResponseSchema } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The global setup swaps `ServiceError` for a double the error handler does not
// recognise; the real class is restored so 404 / 500 map correctly.
vi.mock('@repo/service-core', async () => vi.importActual('@repo/service-core'));

const { renderSpy } = vi.hoisted(() => ({ renderSpy: vi.fn() }));
vi.mock('@repo/notifications', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/notifications')>();
    renderSpy.mockImplementation(actual.renderEmailCatalogScenario);
    return { ...actual, renderEmailCatalogScenario: renderSpy };
});

import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';
import { getEmailSender } from '../../src/utils/email-sender.js';
import { apiLogger } from '../../src/utils/logger.js';

const ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LIST = '/api/v1/admin/email-previews';
const RENDER = '/api/v1/admin/email-previews/render';
const KEY = 'auth.reset-password';
const SCENARIO = 'with-name';

const headersFor = (permissions: readonly string[]) => ({
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', ...permissions])
});
const PREVIEWER = headersFor(['notification.template.preview']);
const NOT_PREVIEWER = headersFor(['notification.view']);
const GUEST = { 'user-agent': 'vitest' };

const renderUrl = (query: Record<string, string>) =>
    `${RENDER}?${new URLSearchParams(query).toString()}`;

describe('admin email preview endpoints (HOS-2519)', () => {
    let app: AppOpenAPI;
    let actualRender: (...args: unknown[]) => unknown;

    beforeEach(async () => {
        app = initApp();
        actualRender = (
            await vi.importActual<typeof import('@repo/notifications')>('@repo/notifications')
        ).renderEmailCatalogScenario as (...args: unknown[]) => unknown;
        renderSpy.mockReset();
        renderSpy.mockImplementation(actualRender);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('AC-5.1 authorization', () => {
        it.each([
            LIST,
            renderUrl({ key: KEY, scenarioId: SCENARIO })
        ])('answers 401 to a guest on %s', async (url) => {
            const res = await app.request(url, { headers: GUEST });

            expect(res.status).toBe(401);
            expect(renderSpy).not.toHaveBeenCalled();
        });

        it.each([
            LIST,
            renderUrl({ key: KEY, scenarioId: SCENARIO })
        ])('answers 403 on %s to an admin without NOTIFICATION_TEMPLATE_PREVIEW', async (url) => {
            const res = await app.request(url, { headers: NOT_PREVIEWER });

            expect(res.status).toBe(403);
            expect(renderSpy).not.toHaveBeenCalled();
        });

        it('answers 403 before validating the query', async () => {
            const res = await app.request(RENDER, { headers: NOT_PREVIEWER });

            expect(res.status).toBe(403);
        });
    });

    describe('AC-5.4 list', () => {
        it('returns the whole catalog in catalog order, and the body parses', async () => {
            // Act
            const res = await app.request(LIST, { headers: PREVIEWER });
            const body = (await res.json()) as { data: unknown };

            // Assert
            expect(res.status).toBe(200);
            const parsed = EmailPreviewListResponseSchema.parse(body.data);
            expect(parsed.total).toBe(EMAIL_CATALOG.length);
            expect(parsed.entries.map((entry) => entry.key)).toEqual(
                EMAIL_CATALOG.map((entry) => entry.key)
            );
            expect(parsed.entries.some((entry) => !entry.wired)).toBe(true);
        });

        it('AC-1.3: carries the audience on every entry, 13 of them staff', async () => {
            // Act
            const res = await app.request(LIST, { headers: PREVIEWER });
            const body = (await res.json()) as { data: unknown };

            // Assert
            const parsed = EmailPreviewListResponseSchema.parse(body.data);
            expect(
                parsed.entries.every((entry) => ['user', 'staff'].includes(entry.audience))
            ).toBe(true);
            expect(parsed.entries.filter((entry) => entry.audience === 'staff')).toHaveLength(13);
        });
    });

    describe('AC-5.1 render', () => {
        it('renders a scenario through the real pipeline, and the body parses', async () => {
            // Act
            const res = await app.request(renderUrl({ key: KEY, scenarioId: SCENARIO }), {
                headers: PREVIEWER
            });
            const body = (await res.json()) as { data: unknown };

            // Assert
            expect(res.status).toBe(200);
            const parsed = EmailPreviewRenderResponseSchema.parse(body.data);
            expect(parsed).toMatchObject({ key: KEY, scenarioId: SCENARIO, warnings: [] });
            // AC-5.5: the prefix the inbox of this deploy would show (null when unmarked).
            expect(parsed.subjectPrefix).toBe(getEmailSender().subjectPrefix ?? null);
            expect(parsed.subject.trim()).not.toBe('');
            expect(parsed.html).toContain('<html');
            expect(parsed.text.trim()).not.toBe('');
            expect(renderSpy).toHaveBeenCalledWith(
                expect.objectContaining({ key: KEY, scenarioId: SCENARIO })
            );
        });
    });

    describe('AC-5.2 validation and existence', () => {
        it.each([
            { scenarioId: SCENARIO },
            { key: KEY },
            { key: '', scenarioId: SCENARIO },
            { key: 'k'.repeat(201), scenarioId: SCENARIO }
        ])('answers 400 VALIDATION_ERROR for the query %j', async (query) => {
            const res = await app.request(renderUrl(query as Record<string, string>), {
                headers: PREVIEWER
            });
            const body = (await res.json()) as { error?: { code?: string } };

            expect(res.status).toBe(400);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(renderSpy).not.toHaveBeenCalled();
        });

        it.each([
            { key: 'auth.does-not-exist', scenarioId: SCENARIO },
            { key: KEY, scenarioId: 'does-not-exist' }
        ])('answers 404 NOT_FOUND for %j', async (query) => {
            const res = await app.request(renderUrl(query), { headers: PREVIEWER });
            const body = (await res.json()) as { error?: { code?: string } };

            expect(res.status).toBe(404);
            expect(body.error?.code).toBe('NOT_FOUND');
            expect(renderSpy).not.toHaveBeenCalled();
        });
    });

    describe('AC-5.3 render failure', () => {
        it('answers 500 INTERNAL_ERROR without the cause, and logs key and scenario', async () => {
            // Arrange
            const secret = 'renderer exploded with a secret detail';
            renderSpy.mockRejectedValue(new Error(secret));
            const errorLog = vi.spyOn(apiLogger, 'error');

            // Act
            const res = await app.request(renderUrl({ key: KEY, scenarioId: SCENARIO }), {
                headers: PREVIEWER
            });
            const raw = await res.text();
            const body = JSON.parse(raw) as { success: boolean; error?: { code?: string } };

            // Assert
            expect(res.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('INTERNAL_ERROR');
            expect(raw).not.toContain(secret);
            expect(errorLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: KEY,
                    scenarioId: SCENARIO,
                    error: expect.objectContaining({ message: secret, stack: expect.any(String) })
                }),
                'Email preview render failed'
            );
        });
    });
});
