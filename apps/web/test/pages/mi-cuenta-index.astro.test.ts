/**
 * @file mi-cuenta-index.astro.test.ts
 * @description Source-level assertions for the account dashboard's role-aware
 * navigation (H-151).
 *
 * WHAT THIS GUARDS. The dashboard is not a static page — it already branches on
 * whether the visitor is a host, prepending "Mis propiedades" and "Panel del
 * anfitrión" to the nav grid. The commerce owner was the one role the branch had
 * never heard of: a merchant whose listing exists and is sitting in DRAFT saw a
 * page that mentioned their business nowhere, while the sidebar right next to it
 * showed "Mi comercio". The dashboard is the first screen they land on, so it is
 * exactly where "your listing is not public yet" has to be visible.
 *
 * LIMIT, stated plainly: Astro pages cannot be rendered under Vitest, so these
 * are string-level assertions on the .astro source (the same pattern as
 * `mi-cuenta-comercio-nuevo.astro.test.ts`). They prove the branch is DECLARED,
 * not that it RENDERS — that second question was answered by hand against the
 * running server, with a commerce-owner session and a tourist session.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/index.astro'),
    'utf8'
);

describe('mi-cuenta/index.astro — role-aware dashboard (H-151)', () => {
    it('resolves commerce access through the shared gating predicate, not a role literal', () => {
        expect(source).toContain('hasCommerceNavAccess');
        // The repo's rule since HOS-296: gate on the role SET via the shared
        // predicate, never by comparing against a role string here.
        expect(source).not.toMatch(/roles.*includes\(\s*['"]COMMERCE_OWNER['"]\s*\)/);
    });

    it('offers the merchant a way into their listing from the dashboard', () => {
        expect(source).toContain('mi-cuenta/comercio');
        expect(source).toContain('account.pages.dashboard.nav.myCommerceDesc');
    });

    it('reuses the sidebar label key so the two surfaces cannot drift apart', () => {
        // The sidebar entry (config/navigation.ts, group `comercio`) already
        // names this destination. Two independent labels for one link is how a
        // rename lands in one place and not the other.
        expect(source).toContain("t('commerce.owner.nav'");
    });

    it('keeps the commerce entry conditional, so a tourist never sees it', () => {
        expect(source).toMatch(/isCommerceOwner\s*\n?\s*\?/);
    });

    it('still gates the host entries independently of commerce', () => {
        // HOS-296: an account can hold BOTH roles, so the two branches must be
        // separate conditions rather than one either/or.
        expect(source).toContain('hasAccommodationsNavAccess');
        expect(source).toContain('account.pages.dashboard.nav.myProperties');
    });

    it('does not describe the merchant inbox as conversations with hosts', () => {
        // The merchant is the one RECEIVING enquiries; the tourist-facing copy
        // ("Conversaciones con anfitriones") describes the opposite party.
        expect(source).toContain('account.pages.dashboard.nav.myMessagesCommerceDesc');
    });
});
