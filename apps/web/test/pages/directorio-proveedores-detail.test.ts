/**
 * @file directorio-proveedores-detail.test.ts
 * @description Source-level regression for the provider detail page on the
 * account kit (HOS-2472): own «not found» copy with no QR mention in any
 * locale, PageHeader with a back link, a retryable error state, the 403 gate
 * kept, and none of the legacy primitives. `.astro` pages cannot be rendered in
 * Vitest.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../../../packages/i18n/src/locales/en/host-trades.json';
import es from '../../../../packages/i18n/src/locales/es/host-trades.json';
import pt from '../../../../packages/i18n/src/locales/pt/host-trades.json';

const page = readFileSync(
    resolve(
        __dirname,
        '../../src/pages/[lang]/mi-cuenta/directorio-proveedores/[slug]/index.astro'
    ),
    'utf8'
);

describe('mi-cuenta provider detail page', () => {
    it('uses the kit PageHeader with a back link', () => {
        expect(page).toMatch(/<PageHeader[\s\S]*?back=\{\{/);
    });

    it('keeps the HOST_TRADE_VIEW 403 gate rendering HostTradesAccessDenied', () => {
        expect(page).toContain('result.error.status === 403');
        expect(page).toMatch(/<HostTradesAccessDenied/);
    });

    it('renders a retryable error island for transient failures', () => {
        expect(page).toMatch(/<ProviderLoadError\s+client:load/);
    });

    it('reads its not-found copy from the detail namespace, not the QR one', () => {
        expect(page).toContain('host-trades.detail.notFound.title');
        expect(page).toContain('host-trades.detail.notFound.body');
        expect(page).not.toContain('registerUsage.notFound');
    });

    it('no longer uses the legacy account primitives', () => {
        expect(page).not.toContain('AccountPageHeader');
        expect(page).not.toContain('AccountSection.module.css');
        expect(page).not.toContain('TradeCategoryBadges');
    });

    it.each([
        ['es', es],
        ['en', en],
        ['pt', pt]
    ])('has a not-found copy without a QR mention (%s)', (_locale, messages) => {
        const { title, body } = messages.detail.notFound;
        expect(title.length).toBeGreaterThan(0);
        expect(body.length).toBeGreaterThan(0);
        expect(`${title} ${body}`).not.toMatch(/\bQR\b|código que escaneaste|scanned|escaneou/i);
    });
});
