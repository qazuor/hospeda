/**
 * Catalog-wide assertions on EmailLayout (HOS-2519 PR-3, made variant-aware by
 * HOS-2565 PR-4).
 *
 * Every scenario of every catalog entry is rendered through the preview
 * dependencies (the same pipeline the admin previewer and the inbox use) and
 * checked for:
 * - AC-4.2: `data-layout-variant` equals the entry's audience.
 * - AC-1.2: one Spanish `<html>`, the hosted isotipo with explicit `width`, the live
 *   "hospeda" wordmark, and no email-unsafe CSS or SVG.
 * - AC-2.1: no unresolved `{{...}}` placeholder and no `unsubscribe_url`.
 * - The user variant: the dark-mode metas and media block, the footer FAQ, and the
 *   preferences link exactly when the reader has an account (frozen set below).
 * - The staff variant: the HOS-2519 footer brand line, light-only.
 * - AC-3.2: a non-empty text part without images or asset URLs.
 * - R-8: HTML under 90 KB (Gmail clips at 102 KB).
 */
import {
    EMAIL_ISOTIPO_URL,
    EMAIL_USER_PREFERENCES_LABEL,
    EMAIL_USER_PREFERENCES_URL
} from '@repo/email';
import {
    EMAIL_CATALOG,
    type EmailCatalogRenderDeps,
    renderEmailCatalogScenario
} from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';

const STAFF_FOOTER_BRAND_LINE = 'Hospeda - Turismo en el Litoral';
const MAX_HTML_BYTES = 90 * 1024;
const FORBIDDEN_IN_HTML = [
    'oklch(',
    'var(--',
    'display:flex',
    'display:grid',
    '<svg',
    '{{'
] as const;

/**
 * User mails whose reader may have no account (HOS-2565 §8.3): they pass
 * `footerLink="none"`, so no preferences or account link. Frozen: a change here is a
 * product decision, not a refactor.
 */
const NO_ACCOUNT_KEYS = [
    'auth.reset-password',
    'auth.verify-email',
    'conversation.verify',
    'conversation.access-link',
    'conversation.new-message-anon',
    'conversation.token-expiring-day15',
    'conversation.token-expiring-day25',
    'newsletter.campaign',
    'newsletter.verify',
    'newsletter.welcome',
    'notification.alliance_claim_invite',
    'outbox.verticals.partner-claim-notice',
    'outbox.verticals.partner-application-rejected'
] as const;

const deps: EmailCatalogRenderDeps = buildEmailPreviewDeps({
    siteUrl: 'https://hospeda.com.ar',
    adminUrl: 'https://admin.hospeda.com.ar',
    environmentLabel: 'STAGING'
});

const cases = EMAIL_CATALOG.flatMap((entry) =>
    entry.scenarios.map((scenario) => [entry.key, scenario.id, entry.audience] as const)
);

describe('email catalog: layout on every scenario (HOS-2519 PR-3, HOS-2565 PR-4)', () => {
    it('has a full catalog and at least one scenario per entry to check', () => {
        // Fails on an empty or truncated catalog, which would make it.each vacuous.
        expect(EMAIL_CATALOG.length).toBeGreaterThanOrEqual(120);
        expect(cases.length).toBeGreaterThanOrEqual(EMAIL_CATALOG.length);
    });

    it('names only user entries in the no-account set', () => {
        // Assert
        for (const key of NO_ACCOUNT_KEYS) {
            const entry = EMAIL_CATALOG.find((candidate) => candidate.key === key);
            expect(entry?.audience, key).toBe('user');
        }
    });

    it.each(
        cases
    )('%s / %s renders inside the email-safe layout', async (key, scenarioId, audience) => {
        // Act
        const { html, text } = await renderEmailCatalogScenario({ key, scenarioId, deps });

        // Assert: AC-4.2
        expect(html.match(/data-layout-variant="(user|staff)"/g)).toEqual([
            `data-layout-variant="${audience}"`
        ]);

        // Assert: AC-1.2
        expect(html.match(/<html\b/g)).toHaveLength(1);
        expect(html.match(/<html\b[^>]*\blang="es"/g)).toHaveLength(1);
        const isotipo = html.match(/<img\b[^>]*\bsrc="[^"]*hospeda-isotipo@2x\.png"[^>]*>/)?.[0];
        expect(isotipo, 'isotipo <img>').toBeDefined();
        expect(isotipo).toContain(`src="${EMAIL_ISOTIPO_URL}"`);
        expect(isotipo).toMatch(/\bwidth="\d+"/);
        expect(html).toMatch(/<span (class="hd-word" )?style="[^"]*">hospeda<\/span>/);
        expect(html).toContain('aria-label="Hospeda"');
        for (const forbidden of FORBIDDEN_IN_HTML) {
            expect(html, `contains ${forbidden}`).not.toContain(forbidden);
        }

        // Assert: AC-2.1
        expect(html).not.toContain('unsubscribe_url');

        // Assert: the variant
        const hasAccount = !(NO_ACCOUNT_KEYS as readonly string[]).includes(key);
        if (audience === 'user') {
            expect(html).toContain('<meta name="color-scheme" content="light dark"/>');
            expect(html.match(/prefers-color-scheme:dark/g)).toHaveLength(1);
            expect(html).toContain('data-layout-faq="true"');
            expect(html.includes('data-layout-link="preferences"'), 'preferences link').toBe(
                hasAccount
            );
            expect(text.includes(EMAIL_USER_PREFERENCES_LABEL)).toBe(hasAccount);
            if (hasAccount) {
                expect(html).toContain(`href="${EMAIL_USER_PREFERENCES_URL}?utm_source=email`);
            }
        } else {
            expect(html).toContain('<meta name="color-scheme" content="light"/>');
            expect(html).toContain(STAFF_FOOTER_BRAND_LINE);
            expect(html).not.toContain('data-layout-faq');
        }

        // Assert: AC-3.2
        expect(text.trim()).not.toBe('');
        expect(text).not.toContain(EMAIL_ISOTIPO_URL);
        expect(text).not.toContain('/email/');

        // Assert: R-8
        expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(MAX_HTML_BYTES);
    });

    it.each([
        ['recipient-owns-publications', 'Gestioná tus publicaciones'],
        ['recipient-partner-only', 'Gestioná tu cuenta'],
        ['recipient-tourist', 'Gestioná tu cuenta']
    ])('picks the D16 account link for scenario %s', async (scenarioId, label) => {
        // Act
        const { html } = await renderEmailCatalogScenario({
            key: 'notification.payment_success',
            scenarioId,
            deps
        });

        // Assert
        expect(html).toMatch(new RegExp(`data-layout-link="account"[^>]*>${label}</a>`));
    });
});
