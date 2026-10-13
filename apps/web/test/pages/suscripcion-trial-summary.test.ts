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
            /TRIAL_SUMMARY_VERTICALS: readonly PublishVerticalSlug\[\] = \[\s*'accommodation',\s*'gastronomy',\s*'experience'\s*\]/
        );
        expect(source).toContain('await Promise.all(');
        expect(source).toContain('publishApi.trialSummary({ vertical, cookieHeader })');
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('TEST:V8a:7 — a failed read (error result or throw) leaves the vertical out', () => {
        expect(source).toContain('return result.ok ? [{ vertical, summary: result.data }] : [];');
        expect(source).toMatch(/\} catch \{\s*return \[\];\s*\}/);
    });

    it('mounts TrialSummary right under the header, as one movable block', () => {
        expect(source).toContain(
            "import TrialSummary from '@/components/account/TrialSummary.astro';"
        );
        expect(source).toMatch(
            /<AccountPageHeader title=\{title\} \/>\s*<TrialSummary locale=\{locale\} entries=\{trialSummaries\} \/>/
        );
    });

    it('still makes no billing call', () => {
        expect(source).not.toMatch(/billingApi|\/billing\//);
    });
});
