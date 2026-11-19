import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenuePromotionsManager } from '../../../src/components/venue/VenuePromotionsManager.client';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
    limitMessage: vi.fn()
}));
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    venuePromotionsApi: {
        list: mocks.list,
        create: mocks.create,
        update: mocks.update,
        patch: mocks.patch,
        remove: mocks.remove
    }
}));
vi.mock('../../../src/lib/billing-limit-error', () => ({
    buildLimitReachedPayloadFromDetails: mocks.limitMessage
}));
vi.mock('../../../src/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: vi.fn().mockResolvedValue(true)
}));
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, string | number>) => {
            const messages: Record<string, string> = {
                'venue.owner.editor.promotionsManager.actions.delete': 'Borrar',
                'venue.owner.editor.promotionsManager.actions.edit': 'Editar',
                'venue.owner.editor.promotionsManager.actions.pause': 'Pausar',
                'venue.owner.editor.promotionsManager.actions.activate': 'Reactivar',
                'venue.owner.editor.promotionsManager.actions.save': 'Guardar'
            };
            return (fallback ?? messages[key] ?? key).replace(
                /\{\{(\w+)\}\}/g,
                (_match: string, name: string) => String(params?.[name] ?? `{{${name}}}`)
            );
        }
    })
}));

beforeEach(() => vi.clearAllMocks());

const promotion = {
    id: 'promo-id',
    title: 'Oferta',
    description: null,
    discountType: 'percentage',
    discountValue: 20,
    lifecycleState: 'ACTIVE',
    validFrom: '2026-11-01T00:00:00.000Z',
    validUntil: null
};

function listWithPromotion() {
    mocks.list.mockResolvedValue({
        ok: true,
        data: { items: [promotion], meta: { activeCount: 1, maxActive: 5 } }
    });
}

describe('VenuePromotionsManager', () => {
    it('renders the unlimited count without printing the catalog sentinel', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 2, maxActive: 2147483647 } }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
            />
        );
        expect(await screen.findByText('Promociones activas: 2 · sin tope')).toBeInTheDocument();
        expect(screen.queryByText('2147483647')).not.toBeInTheDocument();
    });

    it('renders nothing while no catalog plan grants the locked section', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 0, maxActive: 0 } }
        });
        const { container } = render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="locked"
                upsellPlanName={null}
            />
        );
        await waitFor(() => expect(mocks.list).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('locks creation at the active limit and names the plan from the catalog', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 5, maxActive: 5 } }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName="Plan de locales"
            />
        );
        expect(
            await screen.findByText(
                'Alcanzaste el tope. El plan Plan de locales permite más promociones.'
            )
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Nueva promoción' })).toBeDisabled();
    });

    it('shows only the moderated free-text field for a special offer and caps percentages at 100', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 0, maxActive: 5 } }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName="Plan de locales"
            />
        );
        fireEvent.click(await screen.findByRole('button', { name: 'Nueva promoción' }));
        const type = screen.getByLabelText('Beneficio');
        fireEvent.change(type, { target: { value: 'special_offer' } });
        expect(screen.getAllByRole('textbox')[1]).toHaveAttribute('maxLength', '1000');
        expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();

        fireEvent.change(type, { target: { value: 'percentage' } });
        expect(screen.getByLabelText('Valor')).toHaveAttribute('max', '100');
    });

    it('maps pause entitlement errors to localized catalog locked copy', async () => {
        listWithPromotion();
        mocks.patch.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'raw api message' }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }));
        expect(
            await screen.findByText('Esta función todavía no está disponible para tu plan.')
        ).toBeInTheDocument();
        expect(screen.queryByText('raw api message')).not.toBeInTheDocument();
    });

    it('maps delete limit errors through the localized promotion limit helper', async () => {
        listWithPromotion();
        mocks.remove.mockResolvedValue({
            ok: false,
            error: {
                status: 403,
                code: 'LIMIT_REACHED',
                details: { limitKey: 'max_active_promotions' },
                message: 'raw api message'
            }
        });
        mocks.limitMessage.mockReturnValue({ message: 'Límite localizado' });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName="Plan de locales"
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
        expect(await screen.findByText('Límite localizado')).toBeInTheDocument();
        expect(mocks.limitMessage).toHaveBeenCalledWith({
            details: { limitKey: 'max_active_promotions' },
            locale: 'es'
        });
    });

    it('localizes other pause and delete errors instead of showing raw API text', async () => {
        listWithPromotion();
        mocks.patch.mockResolvedValue({
            ok: false,
            error: { status: 400, code: 'VALIDATION_ERROR', message: 'host.promotions.invalid' }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }));
        expect(
            await screen.findByText(
                'No se pudo completar la acción. Revisá los datos e intentá de nuevo.'
            )
        ).toBeInTheDocument();
        expect(screen.queryByText('host.promotions.invalid')).not.toBeInTheDocument();
    });
});
