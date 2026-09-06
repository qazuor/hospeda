/**
 * HOS-1063 — static guards over the partner-statistics surface.
 *
 * Three properties that a runtime test cannot give, for the reason AC-7 states:
 * a runtime test asserting "this route does not 403 me" passes just as well
 * against a route that simply HAS NO GATE YET, and it keeps passing right up
 * until someone adds one. The contract is about what the source says, so the
 * assertion is over the source.
 *
 * 1. **AC-7** — `mine-stats.ts` declares no `requiredPermissions` and no
 *    `requireEntitlement`. Both would be wrong, and wrong in opposite
 *    directions: a `PARTNER_*` permission locks an approved partner out of their
 *    own numbers (HOS-278 AC-7), and an entitlement resolves against the
 *    ACCOMMODATION subscription (§5.6), so it would refuse every partner who is
 *    not also a paying host and admit a host who is not a partner.
 *
 * 2. **§7.2 / OQ-7** — no file in the partner-statistics surface decides card
 *    visibility from `tier`. That decision belongs to `resolvePartnerLogoLink`
 *    in `apps/web` and nowhere else; a `tier === 'gold'` test on this side would
 *    be a second source of truth about what the home carousel renders, and the
 *    two would part ways the moment HOS-1159 lands.
 *
 * 3. **AC-11 / G-5** — nothing here touches the dead `partners.analytics`
 *    column. It is named exactly what a future contributor would search for when
 *    asked to store partner metrics, and it is what the ISSUE originally
 *    proposed using, so "we obviously would not" is not a guarantee.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.resolve(__dirname, '../../../src');

const MINE_STATS_ROUTE = path.join(API_SRC, 'routes/partners/protected/mine-stats.ts');
const CLICK_CAPTURE_ROUTE = path.join(API_SRC, 'routes/partner-logo-clicks/capture.ts');

/**
 * Strips block and line comments before matching.
 *
 * Without this every assertion below is defeated by its own documentation: the
 * route's header explains at length why it declares no `requiredPermissions`,
 * and a naive `toContain('requiredPermissions')` would fire on that sentence.
 * The guard would then be red on a correct file and green on a broken one whose
 * author deleted the comment.
 */
const readCode = (file: string): string =>
    readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

describe('HOS-1063 AC-7 — the partner stats route is gated by OWNERSHIP only', () => {
    it('declares no requiredPermissions', () => {
        expect(readCode(MINE_STATS_ROUTE)).not.toMatch(/requiredPermissions/);
    });

    it('declares no requireEntitlement', () => {
        expect(readCode(MINE_STATS_ROUTE)).not.toMatch(/requireEntitlement/);
    });

    /**
     * The positive half. Without it this file passes against a route that was
     * deleted, renamed, or emptied — "contains no permission" is trivially true
     * of a file containing nothing.
     */
    it('is a protected route that reads the actor from the context', () => {
        const code = readCode(MINE_STATS_ROUTE);
        expect(code).toMatch(/createProtectedRoute/);
        expect(code).toMatch(/getActorFromContext/);
    });

    /**
     * The path carries no id, which is what makes "a partner cannot read
     * another's statistics" structural instead of a check that can be forgotten.
     */
    it('exposes no addressable id in its path', () => {
        expect(readCode(MINE_STATS_ROUTE)).toMatch(/path:\s*'\/mine\/stats'/);
        expect(readCode(MINE_STATS_ROUTE)).not.toMatch(/path:\s*'[^']*:\w/);
    });
});

describe('HOS-1063 §7.2 — no card gating by tier on the API side', () => {
    it.each([
        ['mine-stats route', MINE_STATS_ROUTE],
        ['logo click capture route', CLICK_CAPTURE_ROUTE]
    ])('%s never compares a partner tier', (_label, file) => {
        const code = readCode(file);
        expect(code).not.toMatch(/tier\s*===/);
        expect(code).not.toMatch(/['"]gold['"]/);
        expect(code).not.toMatch(/['"]silver['"]/);
    });
});

describe('HOS-1063 AC-11 — the dead partners.analytics column stays dead', () => {
    it.each([
        ['mine-stats route', MINE_STATS_ROUTE],
        ['logo click capture route', CLICK_CAPTURE_ROUTE]
    ])('%s references neither the column nor its accessors', (_label, file) => {
        const code = readCode(file);
        expect(code).not.toMatch(/PartnerAnalytics/);
        expect(code).not.toMatch(/incrementAnalytics/);
        expect(code).not.toMatch(/\banalytics\b/);
    });
});

describe('HOS-1063 A-3 — the public capture endpoint keeps the view beacon contract', () => {
    it('skips auth and rate-limits like POST /views', () => {
        const code = readCode(CLICK_CAPTURE_ROUTE);
        expect(code).toMatch(/skipAuth:\s*true/);
        expect(code).toMatch(/customRateLimit/);
    });

    /**
     * The bot filter is IMPORTED, not re-implemented. Two copies of that regex
     * are two things to update, and the failure mode of them drifting is that
     * one of the two numbers in the panel quietly starts counting crawlers while
     * the other does not.
     */
    it('imports isBotUserAgent from the view capture route instead of redefining it', () => {
        const code = readCode(CLICK_CAPTURE_ROUTE);
        expect(code).toMatch(/import\s*\{\s*isBotUserAgent\s*\}\s*from\s*'\.\.\/views\/capture'/);
        expect(code).not.toMatch(/BOT_UA_REGEX\s*=/);
    });

    /**
     * The visitor hash is computed from the REQUEST, never read out of the body.
     * A client that could supply it could mint a fresh "visitor" per click and
     * inflate the unique count at will.
     */
    it('computes the visitor hash server-side and never reads it from the body', () => {
        const code = readCode(CLICK_CAPTURE_ROUTE);
        expect(code).toMatch(/computeVisitorHash/);
        expect(code).not.toMatch(/parsed\.data\.visitorHash/);
    });
});
