/**
 * @file ExternalReputation.astro.test.ts
 * @description Source-level invariants for the public "Reputación en otras
 * plataformas" block (fix E).
 *
 * An `.astro` component cannot be rendered under vitest, so what is left here
 * is a static guard. It intentionally asserts only real invariants — the two
 * ways this component has published a false claim or an unsafe link:
 *
 * 1. A chip's `href` must never be the raw third-party URL. The value comes
 *    from outside platforms and was never scheme-validated, so it must pass
 *    through `resolveSafeExternalUrl` (HOS-592 allow-list). Fix E extends the
 *    source to `deepLink ?? url` so a link-only listing still renders.
 * 2. The "mostrando solo el puntaje" note is gated by `hasAggregate` — it may
 *    only appear when there is actually a score to show.
 *
 * Behaviour of the underlying predicate is covered by
 * `test/lib/external-reputation-visibility.test.ts`, which can execute.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSrc = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/ExternalReputation.astro'),
    'utf8'
);

describe('ExternalReputation.astro', () => {
    describe('Chip link (fix E + HOS-592 allow-list)', () => {
        it('resolves deepLink ?? url through resolveSafeExternalUrl', () => {
            expect(componentSrc).toContain('resolveSafeExternalUrl(item.deepLink ?? item.url)');
        });

        it('never puts an unresolved raw URL into an href', () => {
            // A stored third-party URL may carry `javascript:` / `data:`; the
            // only value allowed into an href is the allow-listed result.
            expect(componentSrc).not.toContain('href={item.url}');
            expect(componentSrc).not.toContain('href={item.deepLink}');
            expect(componentSrc).toContain('href={deepLinkHref}');
        });

        it('renders nothing at all when every platform is empty', () => {
            // The block must be signal-gated through selectVisibleReputationItems.
            expect(componentSrc).toContain(
                'selectVisibleReputationItems({ items: configuredItems })'
            );
            expect(componentSrc).toContain('if (items.length === 0) {');
        });
    });

    describe('TTL note is gated by hasAggregate', () => {
        it('requires hasAggregate({ item }) in the googleItemTtlExpired computation', () => {
            expect(componentSrc).toContain('hasAggregate({ item })');
            expect(componentSrc).toContain('isGoogleTtlExpired(item)');
        });

        it('only shows the TTL note in the reviews block', () => {
            expect(componentSrc).toContain('googleItemTtlExpired != null');
            expect(componentSrc).toContain('showReviewsBlock');
        });
    });
});
