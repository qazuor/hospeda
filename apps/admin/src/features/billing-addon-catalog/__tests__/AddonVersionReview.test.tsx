// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { VerticalEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
import { AddonVersionForm } from '../AddonVersionForm';
import { AddonVersionReview } from '../AddonVersionReview';
import type { CatalogAddon } from '../lib/addon-version-draft';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-translations', async () => {
    const { createTranslationMock } = await import(
        '../../billing-plan-catalog/components/__tests__/translation-mock'
    );
    return { useTranslations: createTranslationMock };
});

const addon: CatalogAddon = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'featured',
    name: 'Featured',
    description: null,
    versions: [
        {
            id: '11111111-1111-4111-8111-111111111111',
            addonId: '22222222-2222-4222-8222-222222222222',
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: null,
            scopeType: 'LISTING',
            entitlements: ['old'],
            limits: [{ key: 'quota', value: 1 }],
            liveInstances: 3
        }
    ],
    product: {
        id: '33333333-3333-4333-8333-333333333333',
        versionId: '11111111-1111-4111-8111-111111111111',
        price: 100,
        currency: 'ARS',
        chargeKind: 'PERIODICO',
        cycle: 'monthly',
        compatibleVerticals: [VerticalEnum.ACCOMMODATION]
    }
};
const confirmation = {
    current: {
        versionId: addon.versions[0].id,
        price: 100,
        policy: {
            addonId: addon.id,
            validity: 'WHILE_SUBSCRIPTION_ALIVE' as const,
            validityDays: null,
            scopeType: 'LISTING' as const
        }
    },
    proposed: {
        versionId: '44444444-4444-4444-8444-444444444444',
        price: 100,
        policy: {
            addonId: addon.id,
            validity: 'WHILE_SUBSCRIPTION_ALIVE' as const,
            validityDays: null,
            scopeType: 'LISTING' as const
        }
    },
    changes: ['VERSION' as const],
    liveInstancesOnCurrentVersion: 3,
    alreadyPurchasedStaysAnchored: true as const
};
function withQuery(children: ReactNode) {
    return render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {children}
        </QueryClientProvider>
    );
}

describe('TEST:B13b:3 AC:B13b:3 publishing a version shows changes and keeps prior purchases anchored', () => {
    it('renders exact key changes, live count, anchored note and read-only verticals', () => {
        withQuery(
            <AddonVersionReview
                addon={addon}
                current={addon.versions[0]}
                proposed={{
                    ...addon.versions[0],
                    entitlements: ['new'],
                    limits: [{ key: 'quota', value: 2 }]
                }}
                confirmation={confirmation}
                onBack={vi.fn()}
                onPublished={vi.fn()}
            />
        );
        const review = screen.getByTestId('addon-version-review');
        expect(
            within(review).getByTestId('addon-version-change-removed-entitlement:old')
        ).toHaveTextContent('old');
        expect(
            within(review).getByTestId('addon-version-change-added-entitlement:new')
        ).toHaveTextContent('new');
        expect(
            within(review).getByTestId('addon-version-change-changed-limit:quota')
        ).toHaveTextContent('2');
        expect(within(review).getByTestId('addon-version-live-count')).toHaveTextContent('3');
        expect(within(review).getByTestId('addon-version-anchored-note')).toHaveTextContent(
            es.addonCatalogEditor.anchoredNote
        );
        expect(
            within(review).getByText(
                es.addonCatalogEditor.verticalsReadOnly.replace(
                    '{verticals}',
                    es.addonCatalogEditor.verticalNames.accommodation
                )
            )
        ).toBeInTheDocument();
        expect(within(review).queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('publishes the reviewed version with exact expected current values', async () => {
        fetchApi.mockResolvedValueOnce({
            data: {
                data: {
                    product: {
                        id: addon.product?.id,
                        addonId: addon.id,
                        versionId: confirmation.proposed.versionId,
                        price: 100
                    },
                    domainEventId: '55555555-5555-4555-8555-555555555555'
                }
            }
        });
        const onPublished = vi.fn();
        withQuery(
            <AddonVersionReview
                addon={addon}
                current={addon.versions[0]}
                proposed={addon.versions[0]}
                confirmation={confirmation}
                onBack={vi.fn()}
                onPublished={onPublished}
            />
        );
        fireEvent.click(screen.getByTestId('addon-version-publish'));
        await screen.findByTestId('addon-version-review');
        expect(fetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/billing-addon-products/${addon.product?.id}/version-publication`,
            method: 'POST',
            body: {
                addonVersionId: confirmation.proposed.versionId,
                price: 100,
                expectedCurrentVersionId: addon.product?.versionId,
                expectedCurrentPrice: 100
            }
        });
        await vi.waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    });

    it('explains the live-purchase 409 and keeps verticals read only during publication', async () => {
        fetchApi.mockReset();
        fetchApi.mockResolvedValueOnce({ data: { data: { id: confirmation.proposed.versionId } } });
        fetchApi.mockRejectedValueOnce(
            new ApiError('conflict', {
                status: 409,
                body: { error: { reason: 'ADDON_PRODUCT_HAS_LIVE_INSTANCES' } }
            })
        );
        withQuery(
            <AddonVersionForm
                addon={addon}
                onCancel={vi.fn()}
                onPublished={vi.fn()}
            />
        );
        fireEvent.change(screen.getByLabelText(es.addonCatalogEditor.price), {
            target: { value: '120' }
        });
        expect(
            screen.getByText(
                es.addonCatalogEditor.verticalsReadOnly.replace(
                    '{verticals}',
                    es.addonCatalogEditor.verticalNames.accommodation
                )
            )
        ).toBeInTheDocument();
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        fireEvent.click(screen.getByTestId('addon-version-preview'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            es.addonCatalogEditor.livePriceConflict.replace('{count}', '3')
        );
    });
});
