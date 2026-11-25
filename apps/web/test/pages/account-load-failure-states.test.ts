/**
 * @file account-load-failure-states.test.ts
 * @description Source-reading regression tests (HOS-2421, HOS-2422): an API
 * failure on `/mi-cuenta/comercio/` and `/mi-cuenta/consultas/` must render an
 * error state with a retry, never the "you have none" empty state.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string =>
    readFileSync(resolve(__dirname, '../../src/pages/[lang]/mi-cuenta', rel), 'utf8');

describe('mi-cuenta/comercio/index.astro — API failure (HOS-2421)', () => {
    const source = read('comercio/index.astro');

    it('catches OwnerListingsUnavailableError and flags the failure', () => {
        expect(source).toContain('OwnerListingsUnavailableError');
        expect(source).toContain('listingsLoadFailed = true');
    });

    it('renders the kit ErrorState (retry) BEFORE the empty state (HOS-2484)', () => {
        const errorAt = source.indexOf('listingsLoadFailed ? (');
        const emptyAt = source.indexOf('listings.length === 0 ? (');
        expect(errorAt).toBeGreaterThan(-1);
        expect(emptyAt).toBeGreaterThan(errorAt);
        const errorBranch = source.slice(errorAt, emptyAt);
        expect(errorBranch).toContain('<PageLoadError');
        expect(errorBranch).toContain('`listing.owner.list.loadError.title.${listVertical}`');
        expect(errorBranch).not.toContain('EmptyState');
    });

    it('keeps the real empty state', () => {
        expect(source).toContain('`listing.owner.list.empty.${listVertical}`');
        expect(source).toContain('`listing.owner.list.emptyCta.${listVertical}`');
    });
});

describe('mi-cuenta/consultas/index.astro — API failure (HOS-2422, on the kit since HOS-2481)', () => {
    const source = read('consultas/index.astro');

    it('reads no conversation on the server: the island owns the async states', () => {
        expect(source).not.toContain('protectedConversationsApi');
        expect(source).toContain('<ConversationInbox client:load locale={locale} viewer="guest"');
    });

    it('a forced fetch failure renders ErrorState, never the empty inbox', () => {
        // Behaviour test: test/components/account/conversations/ConversationInbox.test.tsx
        const island = readFileSync(
            resolve(
                __dirname,
                '../../src/components/account/conversations/ConversationInbox.client.tsx'
            ),
            'utf8'
        );
        expect(island).toContain('settleAsync(');
        expect(island).toContain('<AsyncRegion');
        expect(island).toContain("t('conversations.inbox.loadError.title')");
    });
});
