/**
 * @file photo-limit-toast.test.ts
 * @description HOS-724 — the at-cap photo toast: which copy, and which CTA
 * leads.
 *
 * ## Why the real translator and the real resolver
 *
 * Both are deliberate. A mocked `t()` would let this suite stay green with the
 * i18n entries missing (the exact shape of the HOS-700 bug: the copy silently
 * degrading to the generic fallback while every test passed), and a mocked
 * `resolveLimitAddonOffer` would let it stay green with a hand-composed URL
 * that has lost `?focus=` — the half that actually does the work. So the only
 * thing stubbed here is the ONE branch reality cannot produce today:
 * `max_photos_per_accommodation` losing its add-on.
 *
 * The URLs are asserted whole, never with `toContain('addons')`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildPhotoLimitToast,
    isLimitReachedError
} from '@/components/host/editor/photo-limit-toast';
import type { ApiError } from '@/lib/api/types';
import { createT, createTranslations } from '@/lib/i18n';

const { addonOfferOverride } = vi.hoisted(() => ({
    addonOfferOverride: { value: undefined as undefined | null }
}));

// PARTIAL mock (`importOriginal`): everything else in the module — and the
// module's own imports — stay real, so an accidental rename here still fails
// instead of silently resolving to `undefined`.
vi.mock('@/lib/billing/limit-addon-offer', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/billing/limit-addon-offer')>();
    return {
        ...actual,
        resolveLimitAddonOffer: (params: { locale: 'es' | 'en' | 'pt'; limitKey: string }) =>
            addonOfferOverride.value === null ? null : actual.resolveLimitAddonOffer(params)
    };
});

const PHOTO_LIMIT_DETAILS = {
    limitKey: 'max_photos_per_accommodation',
    currentCount: 15,
    maxAllowed: 15,
    usagePercent: 100,
    upgradeAudience: 'host'
} as const;

/** The whole add-on URL, both halves. Losing `?focus=` must fail this suite. */
const EXPECTED_ADDON_HREF_ES = '/es/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20';
const EXPECTED_PLAN_HREF_ES = '/es/mi-cuenta/suscripcion/';

afterEach(() => {
    addonOfferOverride.value = undefined;
});

describe('isLimitReachedError', () => {
    const base: ApiError = { status: 403, message: 'nope', code: 'LIMIT_REACHED' };

    it('is true only for a 403 LIMIT_REACHED', () => {
        expect(isLimitReachedError({ error: base })).toBe(true);
    });

    it('is false for the same code on another status', () => {
        expect(isLimitReachedError({ error: { ...base, status: 500 } })).toBe(false);
    });

    it('is false for another code on 403', () => {
        expect(isLimitReachedError({ error: { ...base, code: 'FORBIDDEN' } })).toBe(false);
    });

    it('is false when there is no code at all (plain upload failure)', () => {
        expect(isLimitReachedError({ error: { status: 500, message: 'Network error' } })).toBe(
            false
        );
    });
});

describe('buildPhotoLimitToast — copy', () => {
    it('renders the photo-specific plural line with the real counts, not the generic fallback', () => {
        const { tPlural } = createTranslations('es');
        const expected = tPlural('billing.limit.max_photos_per_accommodation.message', 15, {
            currentCount: 15,
            maxAllowed: 15
        });

        // Sanity: the key really exists in the locale file. Without this the
        // assertion below could pass while both sides resolved to the same
        // "[MISSING: ...]" placeholder.
        expect(expected).toContain('15');
        expect(expected).not.toContain('MISSING');

        const toast = buildPhotoLimitToast({ details: PHOTO_LIMIT_DETAILS, locale: 'es' });

        expect(toast.message).toBe(expected);
        // The generic sentence `billing-limit-error.ts` falls back to.
        expect(toast.message).not.toBe(
            'Alcanzaste el límite de tu plan. Actualizalo para continuar.'
        );
    });

    it('resolves photo-specific copy in en and pt too', () => {
        for (const locale of ['en', 'pt'] as const) {
            const toast = buildPhotoLimitToast({ details: PHOTO_LIMIT_DETAILS, locale });
            const { tPlural } = createTranslations(locale);

            expect(toast.message).toBe(
                tPlural('billing.limit.max_photos_per_accommodation.message', 15, {
                    currentCount: 15,
                    maxAllowed: 15
                })
            );
            expect(toast.message).not.toContain('MISSING');
        }
    });

    it('falls back to the photo-specific TITLE (never the raw API string) when counts are missing', () => {
        const toast = buildPhotoLimitToast({
            details: { limitKey: 'max_photos_per_accommodation' },
            locale: 'es'
        });

        const expectedTitle = createT('es')('billing.limit.max_photos_per_accommodation.title');
        expect(expectedTitle).not.toContain('MISSING');
        expect(toast.message).toBe(expectedTitle);
    });
});

describe('buildPhotoLimitToast — prominence', () => {
    it('puts the add-on in the PRIMARY slot and demotes the plan to the secondary slot', () => {
        const toast = buildPhotoLimitToast({ details: PHOTO_LIMIT_DETAILS, locale: 'es' });

        // Naming the slot is the point: asserting only that both links exist
        // would pass with the order inverted.
        expect(toast.action.href).toBe(EXPECTED_ADDON_HREF_ES);
        expect(toast.secondaryAction?.href).toBe(EXPECTED_PLAN_HREF_ES);
    });

    it('labels each slot with the shared keys (add-on CTA, plan CTA)', () => {
        const t = createT('es');
        const toast = buildPhotoLimitToast({ details: PHOTO_LIMIT_DETAILS, locale: 'es' });

        expect(toast.action.label).toBe(t('account.subscription.usage.buyAddon'));
        expect(toast.action.label).not.toContain('MISSING');
        expect(toast.secondaryAction?.label).toBe(
            t('billing.limit.max_photos_per_accommodation.cta')
        );
        expect(toast.secondaryAction?.label).not.toContain('MISSING');
    });

    it('builds the add-on URL per locale', () => {
        expect(
            buildPhotoLimitToast({ details: PHOTO_LIMIT_DETAILS, locale: 'en' }).action.href
        ).toBe('/en/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20');
    });

    it('makes the plan CTA primary and the ONLY action when no add-on raises this cap', () => {
        addonOfferOverride.value = null;

        const toast = buildPhotoLimitToast({ details: PHOTO_LIMIT_DETAILS, locale: 'es' });

        expect(toast.action.href).toBe(EXPECTED_PLAN_HREF_ES);
        // Never a bare add-ons link to a card that is not on the page.
        expect(toast.secondaryAction).toBeUndefined();
    });
});
