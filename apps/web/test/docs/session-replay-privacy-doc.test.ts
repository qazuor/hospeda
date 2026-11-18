/**
 * @file session-replay-privacy-doc.test.ts
 * @description HOS-2347 AC-D1 (and AC-S7 as rewritten by the spike): the
 * privacy doc no longer claims Umami has no recording, and states masking,
 * consent, propagation, retention, the six blocked surfaces and the
 * production verification procedure.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DOC = readFileSync(
    resolve(import.meta.dirname, '../../../../docs/analytics/session-replay-privacy.md'),
    'utf8'
);

describe('session-replay-privacy.md (HOS-2347 AC-D1)', () => {
    it('drops the stale "has no session recording" claim', () => {
        expect(DOC).not.toMatch(/has no session recording/i);
    });

    it.each([
        ['strict masking', /`strict`/],
        ['no selective unmask', /no selective unmask/i],
        ['the consent rule', /usage analytics/i],
        ['no forced reload', /Nothing forces a reload/],
        ['the 60 s switch-off bound', /60 s/],
        ['indefinite retention (AC-S7, spike)', /retention in force today is \*\*indefinite\*\*/],
        ['the AC-SM6 procedure', /AC-SM6/],
        ['the sign-off command', /\/smoke HOS-2347/],
        ['the measured per-page-load replay cap', /stops for good in that page load/],
        ['that heatmaps are not capped', /Heatmaps are not capped/]
    ])('states %s', (_label, pattern) => {
        expect(DOC).toMatch(pattern);
    });

    it.each([
        'ContactHost',
        'WhatsAppContact',
        'VenueContactBlock',
        'ExperienceContactBlock',
        'CookieConsentBanner',
        'FeedbackHeadlessHost'
    ])('lists the blocked surface %s', (surface) => {
        expect(DOC).toContain(surface);
    });

    it('points to the exclusion constant instead of copying it', () => {
        expect(DOC).toContain('RECORDING_EXCLUDED_ROUTE_PREFIXES');
    });
});
