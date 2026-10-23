/**
 * Tests for the breadcrumb label maps and their subscription i18n keys
 * (HOS-1754).
 *
 * Covers:
 * - TEST:1754:3 — label map entries for the subscription segments.
 * - TEST:1754:4 — the three new keys exist and are translated in es/en/pt.
 *
 * The i18n JSON files are read from disk so the test fails if a locale is
 * missing a key, even though the runtime translation falls back to English.
 *
 * @see apps/admin/src/lib/breadcrumb-labels.ts
 * @see packages/i18n/src/locales/{es,en,pt}/admin-menu.json
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    breadcrumbLabels,
    breadcrumbRoutePatternLabels,
    breadcrumbSegmentLabels
} from '@/lib/breadcrumb-labels';

type Locale = 'es' | 'en' | 'pt';

const LOCALES: readonly Locale[] = ['es', 'en', 'pt'];

const readBilling = (locale: Locale): Record<string, unknown> => {
    const file = resolve(
        __dirname,
        `../../../../packages/i18n/src/locales/${locale}/admin-menu.json`
    );
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
        billing?: Record<string, unknown>;
    };
    return parsed.billing ?? {};
};

const NEW_KEYS = ['subscription', 'subscriptionCancellation', 'subscriptionRevocation'] as const;

describe('subscription breadcrumb label maps', () => {
    it('maps /billing/subscriptions to the existing subscriptions key', () => {
        expect(breadcrumbLabels['/billing/subscriptions']).toBe('admin-menu.billing.subscriptions');
    });

    it('maps the subscription id route pattern to the short subscription label', () => {
        expect(breadcrumbRoutePatternLabels['/billing/subscriptions/$subscriptionId']).toBe(
            'admin-menu.billing.subscription'
        );
    });

    it('maps the cancellation and revocation leaf segments', () => {
        expect(breadcrumbSegmentLabels.cancellation).toBe(
            'admin-menu.billing.subscriptionCancellation'
        );
        expect(breadcrumbSegmentLabels.revocation).toBe(
            'admin-menu.billing.subscriptionRevocation'
        );
    });
});

describe('subscription breadcrumb i18n keys', () => {
    it('defines the three new keys as non-empty strings in every locale', () => {
        for (const locale of LOCALES) {
            const billing = readBilling(locale);
            for (const key of NEW_KEYS) {
                expect(typeof billing[key], `${locale}.${key}`).toBe('string');
                expect((billing[key] as string).trim().length, `${locale}.${key}`).toBeGreaterThan(
                    0
                );
            }
        }
    });

    it('uses the expected Spanish copy', () => {
        const es = readBilling('es');
        expect(es.subscription).toBe('Suscripción');
        expect(es.subscriptionCancellation).toBe('Baja');
        expect(es.subscriptionRevocation).toBe('Revocación');
    });

    it('does not copy the Spanish copy into en or pt', () => {
        const es = readBilling('es');
        for (const locale of ['en', 'pt'] as const) {
            const billing = readBilling(locale);
            for (const key of NEW_KEYS) {
                expect(billing[key], `${locale}.${key}`).not.toBe(es[key]);
            }
        }
    });
});
