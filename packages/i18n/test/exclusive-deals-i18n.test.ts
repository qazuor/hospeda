/**
 * Key-parity test for the `account.exclusiveDeals` / `account.pages.exclusiveDeals`
 * i18n keys (HOS-21 T-004).
 *
 * Mirrors the existing `account.alerts` / `account.pages.alerts` keys (price
 * alerts), which have no dedicated test file of their own and rely solely on
 * the generic `key-coverage.test.ts` parity check. This dedicated test exists
 * so a reviewer can confirm HOS-21's specific keys without scanning the full
 * generic suite output — same rationale as `admin-whats-new-i18n.test.ts`.
 *
 * @see packages/i18n/src/locales/es/account.json — baseline
 * @see packages/i18n/src/locales/en/account.json
 * @see packages/i18n/src/locales/pt/account.json
 */

import { describe, expect, it } from 'vitest';
import accountEn from '../src/locales/en/account.json';
import accountEs from '../src/locales/es/account.json';
import accountPt from '../src/locales/pt/account.json';

const REQUIRED_PAGE_KEYS = ['title', 'description'] as const;

const REQUIRED_FEATURE_KEYS = [
    'empty.title',
    'empty.body',
    'upgrade.title',
    'upgrade.message',
    'upgrade.cta',
    'listLabel',
    'item.vipBadge'
] as const;

function resolve(obj: Record<string, unknown>, key: string): unknown {
    return key
        .split('.')
        .reduce<unknown>(
            (current, part) =>
                current && typeof current === 'object'
                    ? (current as Record<string, unknown>)[part]
                    : undefined,
            obj
        );
}

describe('account.pages.exclusiveDeals (HOS-21 T-004)', () => {
    const locales = { es: accountEs, en: accountEn, pt: accountPt };

    for (const key of REQUIRED_PAGE_KEYS) {
        it(`has a non-empty "${key}" in every locale`, () => {
            for (const [localeName, locale] of Object.entries(locales)) {
                const pages = (locale as Record<string, unknown>).pages as
                    | Record<string, unknown>
                    | undefined;
                const exclusiveDeals = pages?.exclusiveDeals as Record<string, unknown> | undefined;
                const value = exclusiveDeals?.[key];
                expect(value, `${localeName}: pages.exclusiveDeals.${key}`).toBeTruthy();
                expect(typeof value).toBe('string');
            }
        });
    }
});

describe('account.exclusiveDeals (HOS-21 T-004)', () => {
    const locales = { es: accountEs, en: accountEn, pt: accountPt };

    for (const key of REQUIRED_FEATURE_KEYS) {
        it(`has a non-empty "${key}" in every locale`, () => {
            for (const [localeName, locale] of Object.entries(locales)) {
                const exclusiveDeals = (locale as Record<string, unknown>).exclusiveDeals as
                    | Record<string, unknown>
                    | undefined;
                const value = exclusiveDeals ? resolve(exclusiveDeals, key) : undefined;
                expect(value, `${localeName}: exclusiveDeals.${key}`).toBeTruthy();
                expect(typeof value).toBe('string');
            }
        });
    }
});
