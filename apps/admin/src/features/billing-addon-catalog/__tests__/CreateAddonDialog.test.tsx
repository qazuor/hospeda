// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
import { CreateAddonDialog } from '../CreateAddonDialog';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-translations', async () => {
    const { createTranslationMock } = await import(
        '../../billing-plan-catalog/components/__tests__/translation-mock'
    );
    return { useTranslations: createTranslationMock };
});

describe('TEST:B13b:3 AC:B13b:3 creating an addon keeps its first version when product creation fails', () => {
    it('retries only the product on the already created version', async () => {
        fetchApi.mockReset();
        fetchApi.mockResolvedValueOnce({
            data: {
                data: {
                    addon: { id: '11111111-1111-4111-8111-111111111111' },
                    version: { id: '22222222-2222-4222-8222-222222222222' }
                }
            }
        });
        fetchApi.mockRejectedValueOnce(
            new ApiError('product failure', {
                status: 409,
                body: { error: { reason: 'ADDON_PRODUCT_ALREADY_EXISTS' } }
            })
        );
        fetchApi.mockResolvedValueOnce({
            data: {
                data: {
                    id: '33333333-3333-4333-8333-333333333333',
                    addonId: '11111111-1111-4111-8111-111111111111',
                    versionId: '22222222-2222-4222-8222-222222222222',
                    price: 100,
                    currency: 'ARS',
                    chargeKind: 'PERIODICO',
                    cycle: 'monthly',
                    compatibleVerticals: ['accommodation']
                }
            }
        });
        const onCreated = vi.fn();
        render(
            <QueryClientProvider client={new QueryClient()}>
                <CreateAddonDialog
                    open
                    onOpenChange={vi.fn()}
                    onCreated={onCreated}
                />
            </QueryClientProvider>
        );
        fireEvent.change(screen.getByLabelText(es.addonCatalogEditor.slug), {
            target: { value: 'featured' }
        });
        fireEvent.change(screen.getByLabelText(es.addonCatalogEditor.name), {
            target: { value: 'Featured' }
        });
        fireEvent.change(screen.getByLabelText(es.addonCatalogEditor.price), {
            target: { value: '100' }
        });
        fireEvent.click(screen.getByTestId('addon-create-submit'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.addonCatalogEditor.productFailed
        );
        fireEvent.click(screen.getByTestId('addon-create-submit'));
        await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
        expect(fetchApi.mock.calls.map(([request]) => request.path)).toEqual([
            '/api/v1/admin/addon-catalog/addons',
            '/api/v1/admin/billing-addon-products',
            '/api/v1/admin/billing-addon-products'
        ]);
        expect(fetchApi.mock.calls[2][0].body).toMatchObject({
            addonId: '11111111-1111-4111-8111-111111111111',
            versionId: '22222222-2222-4222-8222-222222222222',
            price: 100
        });
    });
});
