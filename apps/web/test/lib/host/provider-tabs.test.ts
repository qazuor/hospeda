/**
 * @file provider-tabs.test.ts
 * @description Tab resolution for `/mi-cuenta/proveedor` (HOS-376 T-050).
 *
 * The tab lives in the URL, which means the value is user-editable. Everything
 * here is about that: a typo, a stale bookmark or a hand-written query must land
 * on a working page, never on an error.
 */

import { describe, expect, it } from 'vitest';
import {
    DEFAULT_PROVIDER_TAB,
    PROVIDER_TABS,
    resolveProviderTab
} from '../../../src/lib/host/provider-tabs';

describe('resolveProviderTab', () => {
    it.each([...PROVIDER_TABS])('accepts %s', (tab) => {
        expect(resolveProviderTab(tab)).toBe(tab);
    });

    it.each([null, undefined, ''])('falls back to the listing for %s', (value) => {
        expect(resolveProviderTab(value)).toBe(DEFAULT_PROVIDER_TAB);
    });

    it('falls back for a value that names no tab', () => {
        expect(resolveProviderTab('valoracioness')).toBe(DEFAULT_PROVIDER_TAB);
    });

    it('does not accept a tab by prefix or by case', () => {
        // Otherwise `?tab=QR` or `?tab=us` would resolve, and the panel a
        // provider lands on would depend on how he typed it.
        expect(resolveProviderTab('QR')).toBe(DEFAULT_PROVIDER_TAB);
        expect(resolveProviderTab('us')).toBe(DEFAULT_PROVIDER_TAB);
    });

    it('defaults to the listing, which is the tab that always has content', () => {
        expect(DEFAULT_PROVIDER_TAB).toBe('ficha');
    });
});
