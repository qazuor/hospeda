/**
 * @file endpoints-host-trade-catalog.test.ts
 * @description The provider trade catalog client call and the `categories`
 * retype of the host-trade response types (HOS-919 T-036; AC-1.1, AC-5.1, AC-6.1).
 *
 * The call is exercised through a mocked `apiClient` so the URL and the typed
 * result are asserted for real. The retype is asserted on the source, since
 * the interfaces have no runtime presence (the typecheck is what proves the
 * shapes compile, and the test file itself is typechecked for that).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PublicHostTradeCatalog } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}));

import { hostTradeCategoryApi } from '../../../src/lib/api/endpoints';

const CATALOG: PublicHostTradeCatalog = {
    groups: [
        {
            slug: 'instalaciones',
            nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalações' },
            displayWeight: 10,
            categories: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    slug: 'plomeria',
                    nameI18n: { es: 'Plomería', en: 'Plumbing', pt: 'Encanamento' },
                    displayWeight: 10,
                    keywordsI18n: { es: ['caño'], en: [], pt: [] }
                }
            ]
        }
    ]
};

describe('hostTradeCategoryApi.getHostTradeCatalog', () => {
    beforeEach(() => {
        get.mockReset();
    });

    it('should call the PUBLIC tier endpoint and return the parsed groups', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: CATALOG });

        // Act
        const result = await hostTradeCategoryApi.getHostTradeCatalog();

        // Assert
        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/v1/public/host-trade-categories' })
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.groups[0]?.categories[0]?.slug).toBe('plomeria');
        }
    });

    it('should never reach the admin tier', async () => {
        // Arrange
        get.mockResolvedValue({ ok: true, data: CATALOG });

        // Act
        await hostTradeCategoryApi.getHostTradeCatalog();

        // Assert
        const call = get.mock.calls[0]?.[0] as { path: string } | undefined;
        expect(call?.path).not.toContain('/admin/');
        expect(call?.path).not.toContain('/protected/');
    });

    it('should surface a typed failure when the endpoint errors (feeds the AC-6.2 fallback)', async () => {
        // Arrange
        get.mockResolvedValue({ ok: false, error: { status: 503, message: 'down' } });

        // Act
        const result = await hostTradeCategoryApi.getHostTradeCatalog();

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.status).toBe(503);
        }
    });
});

describe('endpoints-protected.ts host-trade response types (AC-5.1)', () => {
    const source = readFileSync(
        resolve(__dirname, '../../../src/lib/api/endpoints-protected.ts'),
        'utf8'
    );

    it('should type every provider read with categories: HostTradeCategoryRef[]', () => {
        const matches = source.match(/readonly categories: ReadonlyArray<HostTradeCategoryRef>;/g);
        // MyHostTrade, DirectoryProvider and the BenefitUsage provider ref.
        expect(matches?.length).toBe(3);
    });

    it('should no longer type a single `category` on the provider reads', () => {
        expect(source).not.toMatch(/readonly category: HostTradeCategoryEnum/);
        expect(source).not.toMatch(/\bHostTradeCategoryEnum\b/);
    });
});
