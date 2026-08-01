/**
 * @file robots-policy.test.ts
 * @description HOS-369 AC-A3 — no user-agent may appear in two `robots.txt`
 * groups with conflicting root rules.
 *
 * The spec requires this guard to be **non-vacuous**: it must FAIL if the
 * Cloudflare managed block and the app block are concatenated as they are in
 * production today. A guard that only ever sees the app's own (already
 * consistent) output would pass forever while the real served file stays
 * broken — so the real managed block is checked in as a fixture and asserted
 * against directly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { findConflictingRootRules, parseRobotsGroups } from '../../../src/lib/seo/robots-policy';

vi.mock('@/lib/env', () => ({
    getSiteUrl: vi.fn(() => 'https://hospeda.test'),
    getNoindexHosts: vi.fn(() => undefined)
}));

vi.mock('@/lib/middleware-helpers', () => ({
    parseNoindexHosts: vi.fn(() => ['staging.hospeda.com.ar'])
}));

const CLOUDFLARE_MANAGED_BLOCK = readFileSync(
    resolve(__dirname, '../../fixtures/cloudflare-managed-robots.txt'),
    'utf8'
);

/** The body this app actually emits for an indexable host. */
async function getAppBody(): Promise<string> {
    const { GET } = await import('../../../src/pages/robots.txt.js');
    const response = await GET({
        request: new Request('http://localhost/robots.txt', {
            headers: { host: 'hospeda.com.ar' }
        })
    } as never);
    return await response.text();
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

describe('parseRobotsGroups', () => {
    it('groups consecutive User-agent lines with the rules that follow', () => {
        const groups = parseRobotsGroups({
            body: 'User-agent: A\nUser-agent: B\nDisallow: /x\nAllow: /'
        });

        expect(groups).toHaveLength(1);
        expect(groups[0]?.userAgents).toEqual(['a', 'b']);
        expect(groups[0]?.rules).toEqual([
            { directive: 'disallow', value: '/x' },
            { directive: 'allow', value: '/' }
        ]);
    });

    it('starts a new group when a User-agent line follows a rule line', () => {
        const groups = parseRobotsGroups({
            body: 'User-agent: A\nDisallow: /\nUser-agent: B\nAllow: /'
        });

        expect(groups.map((g) => g.userAgents)).toEqual([['a'], ['b']]);
    });

    it('ignores comments and blank lines', () => {
        const groups = parseRobotsGroups({
            body: '# a comment\n\nUser-agent: A  # trailing\nDisallow: /  # here too\n'
        });

        expect(groups).toHaveLength(1);
        expect(groups[0]?.rules).toEqual([{ directive: 'disallow', value: '/' }]);
    });

    it('does NOT merge a non-rule preamble group into the next group', () => {
        // Cloudflare's block opens with `User-agent: *` + `Content-Signal:`.
        // If that unrecognized field did not close the header, `*` would absorb
        // the following `Disallow: /` and every guard below would report a
        // phantom conflict on `*`.
        const groups = parseRobotsGroups({
            body: 'User-agent: *\nContent-Signal: search=yes\n\nUser-agent: Bytespider\nDisallow: /'
        });

        expect(groups.map((g) => g.userAgents)).toEqual([['*'], ['bytespider']]);
        expect(groups[0]?.rules).toEqual([]);
    });

    it('ignores a Sitemap directive rather than recording it as a rule', () => {
        const groups = parseRobotsGroups({
            body: 'User-agent: *\nAllow: /\n\nSitemap: https://x.test/sitemap.xml\n'
        });

        expect(groups).toHaveLength(1);
        expect(groups[0]?.rules).toEqual([{ directive: 'allow', value: '/' }]);
    });
});

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

describe('findConflictingRootRules', () => {
    it('reports an agent granted root in one group and denied it in another', () => {
        const conflicts = findConflictingRootRules({
            body: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /'
        });

        expect(conflicts).toEqual([
            { userAgent: 'gptbot', allowRootCount: 1, disallowRootCount: 1 }
        ]);
    });

    it('matches user-agent tokens case-insensitively (RFC 9309)', () => {
        const conflicts = findConflictingRootRules({
            body: 'User-agent: gptbot\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /'
        });

        expect(conflicts.map((c) => c.userAgent)).toEqual(['gptbot']);
    });

    it('does NOT treat a scoped Disallow as conflicting with Allow: /', () => {
        // This is the normal, correct shape of our own file. If scoped rules
        // counted, the guard would fire on every healthy robots.txt.
        const conflicts = findConflictingRootRules({
            body: 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /*?*categories='
        });

        expect(conflicts).toEqual([]);
    });

    it('reports nothing for a file with a single coherent policy per agent', () => {
        const conflicts = findConflictingRootRules({
            body: 'User-agent: *\nAllow: /\n\nUser-agent: Bytespider\nDisallow: /'
        });

        expect(conflicts).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// AC-A3 — applied to the real bodies
// ---------------------------------------------------------------------------

describe('AC-A3 — the app-generated robots.txt expresses one policy per agent', () => {
    it('emits no conflicting root rules on its own', async () => {
        const conflicts = findConflictingRootRules({ body: await getAppBody() });
        expect(conflicts).toEqual([]);
    });

    it('is non-vacuous: the app body really does declare root rules to check', async () => {
        // Without this, the assertion above would also pass on an empty file.
        const groups = parseRobotsGroups({ body: await getAppBody() });
        const rootAllowGroups = groups.filter((g) =>
            g.rules.some((r) => r.directive === 'allow' && r.value === '/')
        );

        expect(rootAllowGroups.length).toBeGreaterThanOrEqual(9); // `*` + 8 AI agents
    });
});

describe('AC-A3 — the guard FAILS on the real production concatenation', () => {
    it('detects the Cloudflare-managed vs app-block contradiction', async () => {
        // This is the assertion the spec asks for: prove the detector fires on
        // what production serves today. If this ever returns [], the guard has
        // become vacuous and AC-A3 is no longer being tested.
        const served = `${CLOUDFLARE_MANAGED_BLOCK}\n${await getAppBody()}`;
        const conflicts = findConflictingRootRules({ body: served });

        expect(conflicts.length).toBeGreaterThan(0);
        expect(conflicts.map((c) => c.userAgent)).toEqual([
            'ccbot',
            'claudebot',
            'google-extended',
            'gptbot'
        ]);
    });

    it('does not flag agents the app never mentions (they are cleanly denied)', async () => {
        const served = `${CLOUDFLARE_MANAGED_BLOCK}\n${await getAppBody()}`;
        const flagged = new Set(findConflictingRootRules({ body: served }).map((c) => c.userAgent));

        // Blocked by Cloudflare, never granted by the app → no contradiction,
        // and (per D-4) `applebot-extended` must stay denied.
        for (const agent of [
            'amazonbot',
            'applebot-extended',
            'bytespider',
            'cloudflarebrowserrenderingcrawler',
            'meta-externalagent'
        ]) {
            expect(flagged.has(agent), `${agent} should not be flagged`).toBe(false);
        }
    });

    it('does not flag `*` (Cloudflare declares no root rule for it)', async () => {
        const served = `${CLOUDFLARE_MANAGED_BLOCK}\n${await getAppBody()}`;
        const flagged = new Set(findConflictingRootRules({ body: served }).map((c) => c.userAgent));

        expect(flagged.has('*')).toBe(false);
    });
});
