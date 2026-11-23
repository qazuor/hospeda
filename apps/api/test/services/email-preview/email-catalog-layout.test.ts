/**
 * HOS-2519 PR-3: catalog-wide assertions on the unified EmailLayout.
 *
 * Every scenario of every catalog entry is rendered through the preview
 * dependencies (the same pipeline the admin previewer and the inbox use) and
 * checked for:
 * - AC-1.2: one Spanish `<html>`, the hosted isotipo with explicit
 *   `width`, the live "hospeda" wordmark, the footer brand line, and no email-unsafe CSS or SVG.
 * - AC-2.1: no unresolved `{{...}}` placeholder and no `unsubscribe_url`.
 * - AC-2.2: any preferences link points at the absolute preferences URL.
 * - AC-3.2: a non-empty text part with the footer brand line and without the
 *   isotipo URL or the header tagline.
 * - R-8: HTML under 90 KB (Gmail clips at 102 KB).
 * Plus AC-2.3: the anonymous-guest token mails carry no preferences link.
 */
import { EMAIL_ISOTIPO_URL, EMAIL_PREFERENCES_URL } from '@repo/email';
import {
    EMAIL_CATALOG,
    type EmailCatalogRenderDeps,
    renderEmailCatalogScenario
} from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';

const FOOTER_BRAND_LINE = 'Hospeda - Turismo en el Litoral';
const TAGLINE = 'Turismo en el Litoral';
const PREFERENCES_TEXT = 'Administrar preferencias de notificaciones';
const MAX_HTML_BYTES = 90 * 1024;
const FORBIDDEN_IN_HTML = ['oklch(', 'var(--', 'display:flex', 'display:grid', '<svg'] as const;

const deps: EmailCatalogRenderDeps = buildEmailPreviewDeps({
    siteUrl: 'https://hospeda.com.ar',
    adminUrl: 'https://admin.hospeda.com.ar',
    environmentLabel: 'STAGING'
});

const cases = EMAIL_CATALOG.flatMap((entry) =>
    entry.scenarios.map((scenario) => [entry.key, scenario.id] as const)
);

describe('email catalog: unified layout on every scenario (HOS-2519 PR-3)', () => {
    it('has a full catalog and at least one scenario per entry to check', () => {
        // Fails on an empty or truncated catalog, which would make it.each vacuous.
        expect(EMAIL_CATALOG.length).toBeGreaterThanOrEqual(120);
        expect(cases.length).toBeGreaterThanOrEqual(EMAIL_CATALOG.length);
    });

    it.each(cases)('%s / %s renders inside the email-safe layout', async (key, scenarioId) => {
        // Act
        const { html, text } = await renderEmailCatalogScenario({ key, scenarioId, deps });

        // Assert: AC-1.2
        expect(html.match(/<html\b/g)).toHaveLength(1);
        expect(html.match(/<html\b[^>]*\blang="es"/g)).toHaveLength(1);
        const isotipo = html.match(/<img\b[^>]*\bsrc="[^"]*hospeda-isotipo@2x\.png"[^>]*>/)?.[0];
        expect(isotipo, 'isotipo <img>').toBeDefined();
        expect(isotipo).toContain(`src="${EMAIL_ISOTIPO_URL}"`);
        expect(isotipo).toMatch(/\bwidth="\d+"/);
        expect(html).toMatch(/<span style="[^"]*">hospeda<\/span>/);
        expect(html).toContain('aria-label="Hospeda"');
        expect(html).not.toContain('hospeda-logo@2x.png');
        expect(html).toContain(FOOTER_BRAND_LINE);
        for (const forbidden of FORBIDDEN_IN_HTML) {
            expect(html, `contains ${forbidden}`).not.toContain(forbidden);
        }

        // Assert: AC-2.1
        expect(html).not.toContain('{{');
        expect(html).not.toContain('unsubscribe_url');

        // Assert: AC-2.2 (only when the entry opts into the preferences link)
        if (html.includes(PREFERENCES_TEXT)) {
            expect(html).toContain(`href="${EMAIL_PREFERENCES_URL}"`);
        }

        // Assert: AC-3.2
        expect(text.trim()).not.toBe('');
        expect(text).toContain(FOOTER_BRAND_LINE);
        expect(text).not.toContain(EMAIL_ISOTIPO_URL);
        expect(text.replaceAll(FOOTER_BRAND_LINE, '')).not.toContain(TAGLINE);

        // Assert: R-8
        expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(MAX_HTML_BYTES);
    });

    it.each([
        'conversation.token-expiring-day15',
        'conversation.token-expiring-day25'
    ])('%s (anonymous guest) has no preferences link (AC-2.3)', async (key) => {
        // Arrange
        const entry = EMAIL_CATALOG.find((candidate) => candidate.key === key);
        expect(entry, `catalog entry ${key}`).toBeDefined();

        for (const scenario of entry?.scenarios ?? []) {
            // Act
            const { html, text } = await renderEmailCatalogScenario({
                key,
                scenarioId: scenario.id,
                deps
            });

            // Assert
            expect(html).not.toContain(PREFERENCES_TEXT);
            expect(html).not.toContain(EMAIL_PREFERENCES_URL);
            expect(text).not.toContain(PREFERENCES_TEXT);
        }
    });
});
