/**
 * @file ListingActions.publish.test.tsx
 * @description TEST:1729:5/7 regression coverage for publishing complete business drafts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PublicationStatusEnum } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingActions } from '../../../src/components/listing/ListingActions.client';
import type { OwnerListingSummaryWithState } from '../../../src/lib/listing/owner-listings';

const publishMock = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    publishApi: { publish: publishMock }
}));
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (_key: string, count: number) =>
            `Al publicar arranca tu prueba gratis de ${count} días. Sin tarjeta.`
    })
}));
vi.mock('../../../src/components/listing/ListingActions.module.css', () => ({
    default: new Proxy({}, { get: (_target, prop) => String(prop) })
}));
vi.mock('../../../src/components/host/PublishButton.module.css', () => ({
    default: new Proxy({}, { get: (_target, prop) => String(prop) })
}));
vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`
}));

const PUBLISH = { kind: 'publish', canPublish: true, startsTrial: true, trialDays: 30 } as const;
const publishButtonSource = readFileSync(
    resolve(__dirname, '../../../src/components/host/PublishButton.client.tsx'),
    'utf8'
);
function listing(
    vertical: 'venue' | 'experience',
    overrides: Partial<OwnerListingSummaryWithState> = {}
): OwnerListingSummaryWithState {
    return {
        id: `listing-${vertical}`,
        vertical,
        name: 'Ficha',
        slug: 'ficha',
        type: 'RESTAURANT',
        publicationStatus: PublicationStatusEnum.DRAFT,
        isPublic: false,
        completeness: { complete: true, missing: [] },
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    publishMock.mockResolvedValue({ ok: true, data: {} });
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
            throw new Error('network disabled');
        })
    );
});

describe('ListingActions publish — TEST:1729:5 and TEST:1729:7', () => {
    it.each([
        'venue',
        'experience'
    ] as const)('publishes a complete %s draft through its vertical endpoint and announces the trial', async (vertical) => {
        render(
            <ListingActions
                listing={listing(vertical)}
                locale="es"
                publishAffordance={PUBLISH}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
        expect(
            screen.getByText('Al publicar arranca tu prueba gratis de 30 días. Sin tarjeta.')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                vertical === 'venue'
                    ? 'listing.owner.publish.confirmTitle.gastronomy'
                    : 'listing.owner.publish.confirmTitle.experience'
            )
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sí, publicar' }));
        expect(publishMock).toHaveBeenCalledWith({ vertical, id: `listing-${vertical}` });
        expect(publishButtonSource).toContain('window.location.reload();');
    });

    it('defaults a missing publish affordance to unknown and never shows a publish button', () => {
        render(
            <ListingActions
                listing={listing('venue')}
                locale="es"
            />
        );
        expect(screen.getByTestId('publish-check-failed')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
    });

    it.each([
        ['incomplete draft', { completeness: { complete: false, missing: ['name'] } }],
        ['unknown completeness', { completeness: null }],
        ['published listing', { publicationStatus: PublicationStatusEnum.PUBLISHED }],
        ['purged listing', { publicationStatus: PublicationStatusEnum.PURGED }],
        ['archived listing', { publicationStatus: PublicationStatusEnum.ARCHIVED }],
        ['moderated listing', { publicationStatus: PublicationStatusEnum.MODERATED }]
    ] as const)('does not offer publish for a %s', (_label, override) => {
        const { container } = render(
            <ListingActions
                listing={listing('venue', override)}
                locale="es"
                publishAffordance={PUBLISH}
            />
        );
        expect(container.querySelector('button')).not.toBeInTheDocument();
    });

    it.each([
        ['checkout', { kind: 'checkout', canPublish: false, startsTrial: false, trialDays: null }],
        ['no plans', { kind: 'noPlans', canPublish: false, startsTrial: false, trialDays: null }]
    ] as const)('keeps a complete draft unpublished for the %s affordance', (kind, affordance) => {
        render(
            <ListingActions
                listing={listing('experience')}
                locale="es"
                publishAffordance={affordance as typeof PUBLISH}
            />
        );
        expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
        if (kind === 'checkout') {
            const planLink = screen.getByRole('link', {
                name: 'listing.owner.publish.choosePlan.experience'
            });
            expect(planLink).toHaveAttribute('href', '/es/planes/experiencias/precios/');
        } else {
            expect(screen.getByTestId('publish-no-plans')).toBeInTheDocument();
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
        }
    });
});
