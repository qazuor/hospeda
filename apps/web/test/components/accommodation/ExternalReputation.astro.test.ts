/**
 * @file ExternalReputation.astro.test.ts
 * @description Source-level invariants for the public "Lo que dicen en otras
 * plataformas" block.
 *
 * An `.astro` component cannot be rendered under vitest, so what is left here
 * is a static guard. It intentionally asserts only real invariants:
 *
 * 1. Every outbound link must pass through `resolvePlatformHref`, which applies
 *    the HOS-592 scheme allow-list. A raw third-party URL must never reach an
 *    `href`.
 * 2. The section is signal-gated through `selectVisibleReputationItems`, so an
 *    all-empty block renders nothing (H-133).
 * 3. The TTL note stays gated by `hasAggregate`, so it cannot claim a score
 *    that is not there.
 * 4. The retired subtitle and "why only Google" explainer are gone.
 *
 * Behaviour of the underlying predicates is covered by
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
    describe('Outbound links (HOS-592 allow-list)', () => {
        it('resolves every platform href through resolvePlatformHref', () => {
            expect(componentSrc).toContain('resolvePlatformHref({ item })');
        });

        it('never puts an unresolved raw URL into an href', () => {
            // A stored third-party URL may carry `javascript:` / `data:`; the
            // only values allowed into an href are the allow-listed results.
            expect(componentSrc).not.toContain('href={item.url}');
            expect(componentSrc).not.toContain('href={item.deepLink}');
            expect(componentSrc).toContain('href={deepLinkHref}');
            expect(componentSrc).toContain('href={pillHref}');
            expect(componentSrc).toContain('href={googleHref}');
        });

        it('renders nothing at all when every platform is empty', () => {
            expect(componentSrc).toContain(
                'selectVisibleReputationItems({ items: configuredItems })'
            );
            expect(componentSrc).toContain('if (items.length === 0) {');
        });
    });

    describe('Block structure', () => {
        it('uses the redesigned title and drops the subtitle', () => {
            expect(componentSrc).toContain('external-reputation.section.title');
            expect(componentSrc).not.toContain('external-reputation.section.subtitle');
        });

        it('renders summary rows and link-only pills through the predicates', () => {
            expect(componentSrc).toContain('selectSummaryReputationItems({ items })');
            expect(componentSrc).toContain('selectLinkOnlyReputationItems({ items })');
            expect(componentSrc).toContain('external-reputation.aggregate.reviewsCountOn');
            expect(componentSrc).toContain('external-reputation.alsoOn');
        });

        it('removes the "why only Google" explainer', () => {
            expect(componentSrc).not.toContain('external-reputation.snippets.googleOnly');
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
            expect(componentSrc).toContain('external-reputation.snippets.ttlExpired');
        });
    });
});
