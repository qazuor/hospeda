/**
 * @file business-lines-public-slug-invariant.test.ts
 * @description Catalog invariant for the public business-line collections
 * (HOS-1787 leaf 6.8).
 *
 * The slug map (`PUBLIC_BUSINESS_LINES`) filters by `'urlSlug' in line`, not by
 * `public`. That is equivalent today and must stay equivalent: a line is
 * publicly reachable exactly when it declares a URL slug. Getting this wrong in
 * one direction publishes a collection for a line the product keeps internal;
 * getting it wrong in the other leaves a public line without a page. This test
 * fixes the invariant instead of changing the map, per the orchestration
 * default (a).
 */
import { describe, expect, it } from 'vitest';
import { BUSINESS_LINES } from '../../src/catalog/business-lines.js';

const ALL_LINES = Object.values(BUSINESS_LINES).flat();

describe('business-line catalog: urlSlug ⇔ public (HOS-1787 6.8)', () => {
    it('scans a non-empty catalog', () => {
        expect(ALL_LINES.length).toBeGreaterThan(0);
    });

    it('declares a URL slug on exactly the public lines', () => {
        const mismatches = ALL_LINES.filter((line) => 'urlSlug' in line !== line.public).map(
            (line) => `${line.vertical}:${line.value}`
        );

        expect(mismatches).toEqual([]);
    });
});
