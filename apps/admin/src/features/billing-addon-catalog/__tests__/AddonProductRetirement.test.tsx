// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonProductRetirement } from '../AddonProductRetirement';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-translations', async () => {
    const { createTranslationMock } = await import(
        '../../billing-plan-catalog/components/__tests__/translation-mock'
    );
    return { useTranslations: createTranslationMock };
});

const productId = '22222222-2222-4222-8222-222222222222';
const path = `/api/v1/admin/billing-addon-products/${productId}/retirement`;

describe('TEST:B13b:3 AC:B13b:3 the action 20 screen retires a product while purchases stay anchored', () => {
    beforeEach(() => fetchApi.mockReset());

    it('shows persisted saleability, explains existing purchases, and confirms retirement', async () => {
        fetchApi.mockImplementation(async (input?: { method?: string }) => ({
            data: {
                data: {
                    productId,
                    retiredAt: input?.method === 'POST' ? '2026-11-09T12:00:00.000Z' : null
                }
            }
        }));
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AddonProductRetirement productId={productId} />
            </QueryClientProvider>
        );
        const button = await screen.findByTestId(`addon-product-retire-${productId}`);
        expect(button).toHaveTextContent(es.addonCatalogEditor.retire);
        fireEvent.click(button);
        expect(screen.getByText(es.addonCatalogEditor.retireConfirm)).toBeVisible();
        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: es.addonCatalogEditor.retire
            })
        );
        await waitFor(() => expect(fetchApi).toHaveBeenCalledWith({ path, method: 'POST' }));
        expect(await screen.findByTestId(`addon-product-retired-${productId}`)).toHaveTextContent(
            es.addonCatalogEditor.retired
        );
    });
});
