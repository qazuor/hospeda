/**
 * HOS-294 AC-14 — which cache tags a partner write purges.
 *
 * Two surfaces show a partner and both must be evicted: its own page, and the
 * home carousel. The `home` tag is the one that is easy to forget and expensive
 * to miss — without it a revoked partner's logo stays on the front page for the
 * whole TTL, which is the most visible page on the site.
 *
 * The negative assertion matters just as much: there is deliberately no
 * `list-partner` tag, because the filtered directory was retired and no page
 * lists partners. Emitting one would be a tag nothing purges and nothing
 * matches — the dead-vocabulary failure `@repo/cache-tags` exists to prevent.
 *
 * @module test/revalidation/partner-tags
 */

import { CACHE_TAG_HOME } from '@repo/cache-tags';
import { describe, expect, it } from 'vitest';
import { getAffectedCacheTags } from '../../src/revalidation/entity-tag-mapper';

describe('getAffectedCacheTags — partner (AC-14)', () => {
    it('purges the partner’s own page and the home carousel', () => {
        // Arrange / Act
        const tags = getAffectedCacheTags({
            entityType: 'partner',
            id: '00000000-0000-4000-a000-000000000001',
            slug: 'acme-litoral'
        });

        // Assert
        expect(tags).toContain(CACHE_TAG_HOME);
        expect(tags.some((tag) => tag.includes('acme-litoral'))).toBe(true);
    });

    it('never emits a partner collection tag', () => {
        // Arrange / Act
        const tags = getAffectedCacheTags({
            entityType: 'partner',
            id: '00000000-0000-4000-a000-000000000001',
            slug: 'acme-litoral'
        });

        // Assert
        expect(tags.some((tag) => tag.startsWith('list-'))).toBe(false);
    });

    it('still purges the home when the slug is missing', () => {
        // Arrange — a partner row with no usable slug still affects the
        // carousel, so degrading to "no tags at all" would leave it stale.
        const tags = getAffectedCacheTags({
            entityType: 'partner',
            id: '00000000-0000-4000-a000-000000000001'
        });

        // Assert
        expect(tags).toContain(CACHE_TAG_HOME);
    });
});
