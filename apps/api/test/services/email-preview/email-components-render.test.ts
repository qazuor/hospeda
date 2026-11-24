/**
 * HOS-2565 PR-2: catalog-wide checks of the shared `Callout` and `Button`.
 *
 * Every scenario of every catalog entry is rendered through the preview
 * dependencies (the same pipeline the admin previewer and the inbox use) and checked
 * for:
 * - AC-2.5: no element outside a `data-callout-tone` cell or an allowlisted list card
 *   (tagged `data-card="list"` in PriceDropItem, PromoOfferItem and the AI digest) has a
 *   `border-left` style. A hand-rolled callout reappearing in any template shows up here.
 * - AC-2.6: staff mails hold exactly one `<style>`, the single `.hospeda-btn` media
 *   rule; user mails hold two, the user layout block (which starts with that same
 *   rule) and the dark block apart (HOS-2565 PR-4). Every `<a>` produced by `Button` has the
 *   `hospeda-btn` class and an inline `display:inline-block`.
 *
 * AC-2.9 (size, one `<html lang="es">`, no email-unsafe CSS) is covered by
 * `email-catalog-layout.test.ts` and `email-catalog-render-all.test.ts`.
 */
import {
    EMAIL_BUTTON_CLASS,
    EMAIL_BUTTON_MEDIA_RULE,
    EMAIL_BUTTON_SECONDARY_CLASS,
    EMAIL_USER_DARK_STYLE_BLOCK,
    EMAIL_USER_STYLE_BLOCK
} from '@repo/email';
import {
    EMAIL_CATALOG,
    type EmailCatalogRenderDeps,
    renderEmailCatalogScenario
} from '@repo/notifications';
import { describe, expect, it } from 'vitest';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';

const deps: EmailCatalogRenderDeps = buildEmailPreviewDeps({
    siteUrl: 'https://hospeda.com.ar',
    adminUrl: 'https://admin.hospeda.com.ar',
    environmentLabel: 'STAGING'
});

const cases = EMAIL_CATALOG.flatMap((entry) =>
    entry.scenarios.map((scenario) => [entry.key, scenario.id] as const)
);

const audienceOf = new Map(EMAIL_CATALOG.map((entry) => [entry.key as string, entry.audience]));

/** Opening tags of every element whose inline style carries a `border-left`. */
function bordersLeft({ html }: { readonly html: string }): readonly string[] {
    return (html.match(/<[a-z][^>]*\sstyle="[^"]*border-left:[^"]*"[^>]*>/g) ?? []) as string[];
}

describe('email catalog: shared Callout and Button on every scenario (HOS-2565 PR-2)', () => {
    it('has a full catalog to check', () => {
        // Fails on an empty or truncated catalog, which would make it.each vacuous.
        expect(EMAIL_CATALOG.length).toBeGreaterThanOrEqual(120);
        expect(cases.length).toBeGreaterThanOrEqual(EMAIL_CATALOG.length);
    });

    it.each(
        cases
    )('%s / %s keeps every border-left inside a callout (AC-2.5)', async (key, scenarioId) => {
        // Act
        const { html } = await renderEmailCatalogScenario({ key, scenarioId, deps });
        const offenders = bordersLeft({ html }).filter(
            (tag) => !tag.includes('data-callout-tone=') && !tag.includes('data-card="list"')
        );

        // Assert
        expect(offenders).toEqual([]);
    });

    it.each(
        cases
    )('%s / %s has the single button media rule and well-formed buttons (AC-2.6)', async (key, scenarioId) => {
        // Act
        const { html } = await renderEmailCatalogScenario({ key, scenarioId, deps });
        const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];
        const buttonAnchors = (html.match(/<a\b[^>]*\bdata-utm-content="[^"]*"[^>]*>/g) ??
            []) as string[];

        // Assert
        // The user layout keeps the dark block in a second <style>, so a client that
        // drops one block over a selector it dislikes keeps the button rule.
        expect(styleBlocks.map((match) => match[1])).toEqual(
            audienceOf.get(key) === 'user'
                ? [EMAIL_USER_STYLE_BLOCK, EMAIL_USER_DARK_STYLE_BLOCK]
                : [EMAIL_BUTTON_MEDIA_RULE]
        );
        expect(EMAIL_USER_STYLE_BLOCK.startsWith(EMAIL_BUTTON_MEDIA_RULE)).toBe(true);
        for (const anchor of buttonAnchors) {
            expect(anchor, anchor).toMatch(
                new RegExp(`class="${EMAIL_BUTTON_CLASS}( ${EMAIL_BUTTON_SECONDARY_CLASS})?"`)
            );
            expect(anchor, anchor).toContain('display:inline-block');
        }
    });

    it('exempts only tagged list cards: the cards exist and carry border-left', async () => {
        // Act
        const digest = EMAIL_CATALOG.find(
            (entry) => entry.key === 'notification.ai_questions_weekly_digest'
        );
        const scenario = digest?.scenarios[0];
        const { html } = await renderEmailCatalogScenario({
            key: 'notification.ai_questions_weekly_digest',
            scenarioId: scenario?.id ?? '',
            deps
        });
        const tagged = bordersLeft({ html }).filter((tag) => tag.includes('data-card="list"'));

        // Assert
        expect(tagged.length).toBeGreaterThan(0);
    });

    it('renders callouts and buttons somewhere in the catalog (the checks above are not vacuous)', async () => {
        // Act
        let callouts = 0;
        let buttons = 0;
        for (const [key, scenarioId] of cases) {
            const { html } = await renderEmailCatalogScenario({ key, scenarioId, deps });
            callouts += html.match(/data-callout-tone="/g)?.length ?? 0;
            buttons += html.match(/class="hospeda-btn"/g)?.length ?? 0;
        }

        // Assert
        expect(callouts).toBeGreaterThan(50);
        expect(buttons).toBeGreaterThan(50);
    }, 120000);

    it('renders every callout tone and both button variants in the catalog', async () => {
        // Act
        const tones = new Set<string>();
        let secondary = 0;
        for (const [key, scenarioId] of cases) {
            const { html } = await renderEmailCatalogScenario({ key, scenarioId, deps });
            for (const match of html.matchAll(/data-callout-tone="(\w+)"/g)) {
                tones.add(match[1] ?? '');
            }
            if (html.includes(`class="${EMAIL_BUTTON_CLASS} ${EMAIL_BUTTON_SECONDARY_CLASS}"`)) {
                secondary += 1;
            }
        }

        // Assert
        expect([...tones].sort()).toEqual(['danger', 'info', 'success', 'warning']);
        expect(secondary).toBeGreaterThan(0);
    }, 120000);
});
