/**
 * TEST:V3:4 (HOS-1440, V3.2, AC:V3:3; `V/15` §3): the scope of a key decides
 * how it resolves — a vertical key by `user + vertical`, a global one by `user`
 * — and a metered key declared with scope global is rejected.
 */
import type { CatalogKeyDefinition } from '@repo/schemas';
import { getCatalogKey, isCatalogKey } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    assertMeteredKeyIsVertical,
    isMeteredEntitlement,
    MeteredKeyGlobalScopeError,
    MissingVerticalForVerticalKeyError,
    resolveKeyScope,
    scopeKeyValues
} from '../../src';

/** A definition that the catalog declares, by key. */
function declared(key: string): Pick<CatalogKeyDefinition, 'key' | 'scope'> {
    expect(isCatalogKey({ key })).toBe(true);
    const definition = getCatalogKey({ key });
    if (!definition) throw new Error(`the catalog does not declare ${key}`);
    return definition;
}

describe('TEST:V3:4 — the scope decides how a key resolves', () => {
    it('a vertical key resolves by `user + vertical`', () => {
        const definition = declared('publish_accommodations');
        expect(definition.scope).toBe('vertical');

        expect(resolveKeyScope({ definition, vertical: 'accommodation' })).toStrictEqual({
            by: 'user+vertical',
            vertical: 'accommodation'
        });
    });

    it('a vertical key is not resolved without a vertical', () => {
        const definition = declared('publish_accommodations');

        expect(() => resolveKeyScope({ definition, vertical: null })).toThrow(
            MissingVerticalForVerticalKeyError
        );
    });

    it('a global key resolves by `user`, with or without a vertical', () => {
        const definition = declared('priority_support');
        expect(definition.scope).toBe('global');

        expect(resolveKeyScope({ definition, vertical: null })).toStrictEqual({ by: 'user' });
        expect(resolveKeyScope({ definition, vertical: 'accommodation' })).toStrictEqual({
            by: 'user'
        });
    });

    it('rejects a metered key declared with scope global', () => {
        const definition = { ...declared('priority_support'), scope: 'global' } as const;

        expect(() => assertMeteredKeyIsVertical({ definition, isMetered: true })).toThrow(
            MeteredKeyGlobalScopeError
        );
    });

    it('accepts a metered key of vertical, and a plain global key', () => {
        const verticalDefinition = declared('publish_accommodations');
        expect(() =>
            assertMeteredKeyIsVertical({ definition: verticalDefinition, isMetered: true })
        ).not.toThrow();

        const globalDefinition = declared('priority_support');
        expect(() =>
            assertMeteredKeyIsVertical({ definition: globalDefinition, isMetered: false })
        ).not.toThrow();
    });

    it('reads global keys by user and vertical keys by user plus vertical', () => {
        const accommodation = scopeKeyValues({
            values: new Map([
                ['priority_support', 1],
                ['max_accommodations', 3]
            ]),
            userId: 'user-a',
            vertical: 'accommodation'
        });
        const gastronomy = scopeKeyValues({
            values: new Map([
                ['priority_support', 1],
                ['max_gastronomies', 7]
            ]),
            userId: 'user-a',
            vertical: 'gastronomy'
        });
        expect(
            accommodation.get({ key: 'priority_support', userId: 'user-a', vertical: 'gastronomy' })
        ).toBe(1);
        expect(
            gastronomy.get({ key: 'priority_support', userId: 'user-a', vertical: 'accommodation' })
        ).toBe(1);
        expect(
            accommodation.get({
                key: 'max_accommodations',
                userId: 'user-a',
                vertical: 'gastronomy'
            })
        ).toBeUndefined();
        expect(
            gastronomy.get({
                key: 'max_gastronomies',
                userId: 'user-a',
                vertical: 'accommodation'
            })
        ).toBeUndefined();
        expect(
            accommodation.get({ key: 'priority_support', userId: 'user-b', vertical: null })
        ).toBeUndefined();
    });
});

/**
 * HOS-1654: `isMeteredEntitlement` is the SINGLE definition of "metered" of the
 * program. The action 18 validation (V2.3 / HOS-1436, AC:V2:7 cause (a)) and
 * this package's grant ratchet call it instead of repeating the rule, so its
 * table is pinned here: a quota that is absent (`undefined`), not only `null`,
 * counts as none carried.
 */
describe('isMeteredEntitlement — the single definition of metered (HOS-1654)', () => {
    it('is not metered when both quotas are null', () => {
        expect(isMeteredEntitlement({ planQuota: null, trialQuota: null })).toBe(false);
    });

    it('is metered when only the plan quota is carried', () => {
        expect(isMeteredEntitlement({ planQuota: 5, trialQuota: null })).toBe(true);
    });

    it('is metered when only the trial quota is carried', () => {
        expect(isMeteredEntitlement({ planQuota: null, trialQuota: 7 })).toBe(true);
    });

    it('is metered when both quotas are carried', () => {
        expect(isMeteredEntitlement({ planQuota: 5, trialQuota: 7 })).toBe(true);
    });

    it('treats absent quotas (undefined) as none carried', () => {
        expect(isMeteredEntitlement({})).toBe(false);
        expect(isMeteredEntitlement({ planQuota: undefined, trialQuota: undefined })).toBe(false);
    });

    it('is metered when a quota is carried and the other is absent', () => {
        expect(isMeteredEntitlement({ planQuota: 5 })).toBe(true);
        expect(isMeteredEntitlement({ trialQuota: 7 })).toBe(true);
    });
});
