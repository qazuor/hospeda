// @vitest-environment jsdom
import { formatCurrency } from '@repo/i18n';
import es from '@repo/i18n/locales/es/admin-billing.json';
import { VerticalEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
import { AddonCatalogScreen } from '../AddonCatalogScreen';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-translations', async () => {
    const { createTranslationMock } = await import(
        '../../billing-plan-catalog/components/__tests__/translation-mock'
    );
    return { useTranslations: createTranslationMock };
});

function renderCatalog() {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <AddonCatalogScreen />
        </QueryClientProvider>
    );
}

describe('addon catalog route feedback', () => {
    beforeEach(() => fetchApi.mockReset());

    it('shows the specific 409 code when catalog loading fails', async () => {
        fetchApi.mockRejectedValueOnce(
            new ApiError('server conflict', { status: 409, code: 'CONFLICT' })
        );
        renderCatalog();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.addonCatalogEditor.errors.CONFLICT
        );
    });

    it.each([
        [404, 'NOT_FOUND', es.addonCatalogEditor.errors.NOT_FOUND],
        [422, 'VALIDATION_ERROR', es.addonCatalogEditor.errors.VALIDATION_ERROR]
    ] as const)('shows the %i code message', async (status, code, message) => {
        fetchApi.mockRejectedValueOnce(new ApiError('server text', { status, code }));
        renderCatalog();
        expect(await screen.findByRole('alert')).toHaveTextContent(message);
    });

    it('shows an unknown code as the generic load error', async () => {
        fetchApi.mockRejectedValueOnce(
            new ApiError('server text', { status: 500, code: 'UNKNOWN' })
        );
        renderCatalog();
        expect(await screen.findByRole('alert')).toHaveTextContent(es.addonCatalogEditor.loadError);
    });

    it('displays 250000 cents in es-AR while retaining the integer price', async () => {
        fetchApi.mockImplementation(async (input?: { path: string }) =>
            input?.path.endsWith('/retirement')
                ? {
                      data: {
                          data: {
                              productId: '22222222-2222-4222-8222-222222222222',
                              retiredAt: null
                          }
                      }
                  }
                : {
                      data: {
                          data: {
                              items: [
                                  {
                                      id: '11111111-1111-4111-8111-111111111111',
                                      slug: 'featured',
                                      name: 'Featured',
                                      description: null,
                                      versions: [],
                                      product: {
                                          id: '22222222-2222-4222-8222-222222222222',
                                          versionId: '33333333-3333-4333-8333-333333333333',
                                          price: 250000,
                                          currency: 'ARS',
                                          chargeKind: 'PERIODICO',
                                          cycle: 'monthly',
                                          compatibleVerticals: [VerticalEnum.ACCOMMODATION]
                                      }
                                  }
                              ]
                          }
                      }
                  }
        );
        renderCatalog();
        const row = await screen.findByTestId(
            'addon-catalog-row-11111111-1111-4111-8111-111111111111'
        );
        expect(row.textContent).toContain(
            formatCurrency({ value: 2500, locale: 'es-AR', currency: 'ARS' })
        );
        expect(fetchApi).toHaveBeenCalledWith({ path: '/api/v1/admin/addon-catalog' });
    });
});
