/**
 * @file suscripcion-trial-summary.test.ts
 * @description TEST:V8a:7 (page level, HOS-1492, row 4): Mi Suscripción reads
 * the trial summary of each vertical and mounts `TrialSummary` under the
 * header. A failed read leaves that vertical out; nothing is invented.
 *
 * Astro pages cannot be rendered via Vitest in this repo, so these assertions
 * read the `.astro` source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/suscripcion/index.astro'),
    'utf8'
);

describe('mi-cuenta/suscripcion — row 4 trial summary (HOS-1492)', () => {
    it('TEST:V8a:7 — reads every vertical the route admits, in parallel, with the session cookie', () => {
        expect(source).toMatch(
            /TRIAL_SUMMARY_VERTICALS: readonly PublishVerticalSlug\[\] = \[\s*'accommodation',\s*'venue',\s*'experience'\s*\]/
        );
        expect(source).toContain('await Promise.all(');
        expect(source).toContain('publishApi.trialSummary({ vertical, cookieHeader })');
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('TEST:V8a:7 — a failed read (error result or throw) leaves the vertical out', () => {
        expect(source).toContain('return result.ok ? [{ vertical, summary: result.data }] : [];');
        expect(source).toMatch(/\} catch \{\s*return \[\];\s*\}/);
    });

    it('mounts TrialSummary below the header, as one movable block', () => {
        expect(source).toContain(
            "import TrialSummary from '@/components/account/TrialSummary.astro';"
        );
        // Below the header as one block; HOS-1617 mounts the own-subscriptions
        // list between them.
        const header = source.indexOf('<AccountPageHeader title={title} />');
        const summary = source.indexOf('<TrialSummary locale={locale} entries={trialSummaries}');
        expect(header).toBeGreaterThan(-1);
        expect(summary).toBeGreaterThan(header);
    });

    it('TEST:1772:7 — hands TrialSummary the verticals of the live own subscriptions', () => {
        expect(source).toContain(
            'liveSubscriptionVerticals={ownSubscriptions?.subscriptions.map((row) => row.vertical) ?? []}'
        );
    });

    it('offers trial extensions only for active trials below TrialSummary (AC:B9b:12 HOS-1591 TEST:B9b:12 (support))', () => {
        expect(source).toContain('TrialStatusEnum.TRIAL_ACTIVE');
        expect(source).toContain(
            'trialSummaries.filter(({ summary }) => summary.status === TrialStatusEnum.TRIAL_ACTIVE)'
        );
        const summary = source.indexOf('<TrialSummary locale={locale} entries={trialSummaries}');
        const offer = source.indexOf('data-testid="trial-promo-redeem"');
        expect(summary).toBeGreaterThan(-1);
        expect(offer).toBeGreaterThan(summary);
        expect(source).toContain(
            '<PromoCodeRedeem client:visible vertical={vertical} locale={locale} offer="TRIAL" />'
        );
    });

    // HOS-1617 (AC:B13a:1) made this page read the caller's own subscriptions
    // through `billingSubscriptionApi`; the retired billing client stays out.
    it('never uses the retired billing client', () => {
        expect(source).not.toMatch(/\bbillingApi\b/);
    });
});
