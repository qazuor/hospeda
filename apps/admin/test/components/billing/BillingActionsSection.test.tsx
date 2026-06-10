/**
 * @file BillingActionsSection.test.tsx
 * @description Tests for the Section 3 component of Mi facturación
 * (SPEC-156 T-037). Covers the `buildWebBillingUrl` helper (locale routing
 * + trailing-slash normalization) and the source-level wiring around the
 * latest-invoice download conditional.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWebBillingUrl } from '../../../src/components/billing/BillingActionsSection';

const sectionSrc = readFileSync(
    resolve(__dirname, '../../../src/components/billing/BillingActionsSection.tsx'),
    'utf8'
);

describe('buildWebBillingUrl (T-037 / AC-10)', () => {
    it('routes Spanish users to /es/mi-cuenta/suscripcion', () => {
        expect(buildWebBillingUrl('https://hospeda.com.ar', 'es')).toBe(
            'https://hospeda.com.ar/es/mi-cuenta/suscripcion'
        );
    });

    it('routes English users to /en/mi-cuenta/suscripcion', () => {
        expect(buildWebBillingUrl('https://hospeda.com.ar', 'en')).toBe(
            'https://hospeda.com.ar/en/mi-cuenta/suscripcion'
        );
    });

    it('routes Portuguese users to /pt/mi-cuenta/suscripcion', () => {
        expect(buildWebBillingUrl('https://hospeda.com.ar', 'pt')).toBe(
            'https://hospeda.com.ar/pt/mi-cuenta/suscripcion'
        );
    });

    it('falls back to /es/mi-cuenta/suscripcion for unrecognized locales', () => {
        expect(buildWebBillingUrl('https://hospeda.com.ar', 'fr')).toBe(
            'https://hospeda.com.ar/es/mi-cuenta/suscripcion'
        );
    });

    it('strips a trailing slash from the site URL before appending the path', () => {
        expect(buildWebBillingUrl('https://hospeda.com.ar/', 'es')).toBe(
            'https://hospeda.com.ar/es/mi-cuenta/suscripcion'
        );
    });
});

describe('BillingActionsSection.tsx (T-037)', () => {
    it('imports the env wrapper so the site URL is config-driven', () => {
        expect(sectionSrc).toContain("from '@/env'");
        expect(sectionSrc).toContain('env.VITE_SITE_URL');
    });

    it('renders the manage-subscription link with target="_blank" + rel="noopener noreferrer"', () => {
        expect(sectionSrc).toContain('data-testid="manage-subscription-link"');
        expect(sectionSrc).toContain('target="_blank"');
        expect(sectionSrc).toContain('rel="noopener noreferrer"');
    });

    describe('latest-invoice conditional (AC-11)', () => {
        it('reads the latest invoice via useMyLatestInvoice', () => {
            expect(sectionSrc).toContain('useMyLatestInvoice');
        });

        it('renders the download link only when pdfUrl is present', () => {
            expect(sectionSrc).toContain('latestInvoicePdf');
            expect(sectionSrc).toContain('data-testid="download-invoice-link"');
        });

        it('renders the noLatestInvoice fallback otherwise', () => {
            expect(sectionSrc).toContain('data-testid="no-latest-invoice"');
            expect(sectionSrc).toContain("'admin-pages.billing.actions.noLatestInvoice'");
        });
    });

    it('does NOT include any write CTAs (cancel/change-plan/etc. are deferred to web app)', () => {
        // Defensive guard so any future "Cancelar suscripción" buttons added
        // accidentally inside Mi facturación will trip this test and force a
        // spec review (per spec §3 OUT — no write actions in V1).
        expect(sectionSrc.toLowerCase()).not.toMatch(/cancelar/);
        expect(sectionSrc.toLowerCase()).not.toMatch(/cancel subscription/);
        expect(sectionSrc).not.toMatch(/useMutation\b/);
    });
});
