/**
 * @file session-replay-privacy-doc.test.ts
 * @description HOS-2347 AC-D1 (and AC-S7 as rewritten by the retention
 * decision): the privacy doc no longer claims Umami has no recording, and states
 * masking, consent, propagation, the configurable 14/30/60-day retention with its
 * daily purge (saved replays included), the six blocked surfaces and the
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
        [
            'that Umami never deletes recordings on its own (AC-S7)',
            /no retention setting and no age-based delete API/
        ],
        [
            'the configurable 14, 30 or 60 day retention (AC-S7)',
            /\*\*14, 30 or 60 days\*\*; the default is\s+\*\*30\*\*/
        ],
        ['the daily purge cron', /`session-recording-retention` cron runs daily/],
        ['that the purge runs with the switch OFF', /also while the\s+switch is OFF/],
        ['that saved replays are purged too', /saved replays included/],
        [
            'the restricted role grant on the three tables',
            /GRANT SELECT, DELETE ON session_replay, heatmap_event, session_replay_saved/
        ],
        ['that recordings are pseudonymous, not anonymous', /pseudonymous/],
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
