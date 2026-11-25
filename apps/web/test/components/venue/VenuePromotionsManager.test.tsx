import { LifecycleStatusEnum, LifecycleStatusEnumSchema } from '@repo/schemas';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    resolvePromotionLifecycleState,
    VenuePromotionsManager
} from '../../../src/components/venue/VenuePromotionsManager.client';

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
const entitlements = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../../src/lib/entitlements-cache', () => ({
    getEntitlementsCached: () => entitlements.read()
}));
vi.mock('../../../src/lib/billing-limit-error', () => ({
    buildLimitReachedPayloadFromDetails: mocks.limitMessage
}));
vi.mock('../../../src/lib/i18n', async (importOriginal) => ({
    // The kit reads its copy through the real `createT`.
    ...(await importOriginal<typeof import('../../../src/lib/i18n')>()),
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, string | number>) => {
            const messages: Record<string, string> = {
                'venue.owner.editor.promotionsManager.actions.delete': 'Borrar',
                'venue.owner.editor.promotionsManager.actions.edit': 'Editar',
                'venue.owner.editor.promotionsManager.actions.pause': 'Pausar',
                'venue.owner.editor.promotionsManager.actions.activate': 'Reactivar',
                'venue.owner.editor.promotionsManager.actions.save': 'Guardar',
                'venue.owner.editor.menuManager.seePlans': 'Ver planes'
            };
            return (fallback ?? messages[key] ?? key).replace(
                /\{\{(\w+)\}\}/g,
                (_match: string, name: string) => String(params?.[name] ?? `{{${name}}}`)
            );
        }
    })
}));

beforeEach(() => {
    vi.clearAllMocks();
    entitlements.read.mockResolvedValue({ entitlements: {}, limits: {}, failed: false });
});

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

/** The destructive confirm button of the kit dialog opened by «Borrar». */
async function confirmDeletion(): Promise<HTMLElement> {
    const dialog = await screen.findByRole('alertdialog');
    return within(dialog).getByRole('button', { name: 'Borrar' });
}

describe('VenuePromotionsManager', () => {
    it('pauses a promotion with a lifecycle state accepted by the shared schema', async () => {
        listWithPromotion();
        mocks.patch.mockResolvedValue({ ok: true, data: promotion });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
                limitPlanOptions={[]}
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }));

        await waitFor(() => expect(mocks.patch).toHaveBeenCalled());
        const [{ body }] = mocks.patch.mock.calls[0] as [{ body: { lifecycleState: unknown } }];
        expect(body.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        expect(LifecycleStatusEnumSchema.safeParse(body.lifecycleState).success).toBe(true);
    });

    it('labels inactive promotions as paused and reactivates them with ACTIVE', async () => {
        const inactivePromotion = { ...promotion, lifecycleState: 'INACTIVE' };
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [inactivePromotion], meta: { activeCount: 0, maxActive: 5 } }
        });
        mocks.patch.mockResolvedValue({ ok: true, data: promotion });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
                limitPlanOptions={[]}
            />
        );

        expect(await screen.findByText('Pausada')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }));

        await waitFor(() => expect(mocks.patch).toHaveBeenCalled());
        const [{ body }] = mocks.patch.mock.calls[0] as [{ body: { lifecycleState: unknown } }];
        expect(body.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(LifecycleStatusEnumSchema.safeParse(body.lifecycleState).success).toBe(true);
    });

    it('does not assign an active or expired label before the client clock is set', () => {
        expect(
            resolvePromotionLifecycleState(
                { ...promotion, validUntil: '2026-11-01T00:00:00.000Z' } as never,
                null
            )
        ).toBeNull();
        expect(
            resolvePromotionLifecycleState(
                { ...promotion, validUntil: '2026-11-01T00:00:00.000Z' } as never,
                Date.parse('2026-11-18T00:00:00.000Z')
            )
        ).toBe('expired');
    });

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
                limitPlanOptions={[]}
            />
        );
        expect(await screen.findByText('Promociones activas: 2 · sin tope')).toBeInTheDocument();
        expect(screen.queryByText('2147483647')).not.toBeInTheDocument();
    });

    it('renders the neutral no-plan message without editing actions while locked', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 0, maxActive: 0 } }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="locked"
                upsellPlanName={null}
                limitPlanOptions={[]}
            />
        );
        await waitFor(() => expect(mocks.list).toHaveBeenCalled());
        expect(await screen.findByRole('status')).toHaveTextContent(
            'Las promociones todavía no están disponibles para tu plan.'
        );
        expect(screen.queryByRole('button', { name: 'Agregar promoción' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Ver planes' })).not.toBeInTheDocument();
    });

    it('names the catalog plan and links to compare plans when one grants promotions', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 0, maxActive: 0 } }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="locked"
                upsellPlanName="Plan Profesional"
                limitPlanOptions={[]}
            />
        );
        expect(
            await screen.findByText('Disponible desde el plan Plan Profesional.')
        ).toBeInTheDocument();
        expect(screen.getByText('Plan Profesional', { selector: 'span' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
            'href',
            '/es/planes/comer-y-salir/precios/'
        );
    });

    it('keeps locked promotions listed with pause and delete, edit disabled, no create (owner decision 18)', async () => {
        listWithPromotion();
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="locked"
                upsellPlanName="Plan Profesional"
                limitPlanOptions={[]}
            />
        );

        expect(await screen.findByText('Oferta')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
        // The mocked `t` answers the key itself.
        expect(
            screen.getByText('venue.owner.editor.promotionsManager.lockedExisting')
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reactivar' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Agregar promoción' })).not.toBeInTheDocument();
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
                limitPlanOptions={[{ name: 'Plan Premium', maxActive: 10 }]}
            />
        );
        expect(
            await screen.findByText(
                'Alcanzaste el tope. El plan Plan Premium permite más promociones.'
            )
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agregar promoción' })).toBeDisabled();
    });

    it('shows the no-plan message at the cap when no catalog plan has a higher limit', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 5, maxActive: 5 } }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName="Plan Profesional"
                limitPlanOptions={[{ name: 'Plan Profesional', maxActive: 5 }]}
            />
        );
        expect(
            await screen.findByText('Alcanzaste el tope de promociones de tu plan.')
        ).toBeInTheDocument();
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
                limitPlanOptions={[]}
            />
        );
        fireEvent.click(await screen.findByRole('button', { name: 'Agregar promoción' }));
        const type = screen.getByLabelText('Beneficio');
        fireEvent.change(type, { target: { value: 'special_offer' } });
        expect(screen.getAllByRole('textbox')[1]).toHaveAttribute('maxLength', '1000');
        expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();

        fireEvent.change(type, { target: { value: 'percentage' } });
        expect(screen.getByLabelText('Valor')).toHaveAttribute('max', '100');
    });

    it('renders promotion window copy separately and uses the shared editor field classes', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 0, maxActive: 5 } }
        });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
                limitPlanOptions={[]}
            />
        );
        fireEvent.click(await screen.findByRole('button', { name: 'Agregar promoción' }));
        fireEvent.click(screen.getByLabelText('Activar franja semanal'));
        fireEvent.click(screen.getByLabelText('Jue'));
        fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '22:00' } });
        fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '01:00' } });

        const overnightHint = screen.getByText(
            'Termina después de la medianoche, el día siguiente'
        );
        const preview = screen.getByText('Jue, 22 a 01');
        const help = screen.getByText(
            'Si es una entrada fija de tu agenda, cargala en Eventos. Acá va el beneficio.'
        );
        expect(overnightHint.tagName).toBe('SMALL');
        expect(preview.tagName).toBe('SMALL');
        expect(help.tagName).toBe('SMALL');
        expect(new Set([overnightHint, preview, help]).size).toBe(3);

        expect(screen.getByLabelText('Título')).toHaveClass('input');
        expect(screen.getByLabelText('Beneficio')).toHaveClass('input');
        expect(screen.getByLabelText('Valor')).toHaveClass('input');
        expect(screen.getByLabelText('Condición')).toHaveClass('textarea');
        expect(screen.getByLabelText('Activar franja semanal').closest('label')).toHaveClass(
            'checkbox'
        );
        expect(screen.getByRole('group', { name: 'Solo en ciertos días y horas' })).toHaveClass(
            'section'
        );
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
                limitPlanOptions={[]}
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }));
        expect(
            await screen.findByText('Las promociones todavía no están disponibles para tu plan.')
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
                limitPlanOptions={[]}
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
        fireEvent.click(await confirmDeletion());
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
                limitPlanOptions={[]}
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

    it('asks before deleting and deletes nothing when the owner cancels', async () => {
        listWithPromotion();
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
                limitPlanOptions={[]}
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
        const dialog = await screen.findByRole('alertdialog');
        expect(mocks.remove).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('deletes once the owner confirms and reloads the list', async () => {
        listWithPromotion();
        mocks.remove.mockResolvedValue({ ok: true, data: {} });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
                limitPlanOptions={[]}
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
        fireEvent.click(await confirmDeletion());

        await waitFor(() =>
            expect(mocks.remove).toHaveBeenCalledWith({
                id: 'venue-id',
                promotionId: 'promo-id'
            })
        );
        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    });

    it('shows the kit locked state with the plan and its pricing link', async () => {
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [], meta: { activeCount: 0, maxActive: 0 } }
        });
        const { container } = render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="locked"
                upsellPlanName="Plan Profesional"
                limitPlanOptions={[]}
            />
        );

        await waitFor(() => expect(mocks.list).toHaveBeenCalled());
        expect(container.querySelector('[data-reason="plan"]')).not.toBeNull();
        expect(container.querySelector('[data-kit-section]')).not.toBeNull();
    });

    it('offers a retry when the list fails to load', async () => {
        mocks.list.mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'x' } });
        render(
            <VenuePromotionsManager
                listingId="venue-id"
                locale="es"
                sectionState="available"
                upsellPlanName={null}
                limitPlanOptions={[]}
            />
        );
        mocks.list.mockResolvedValue({
            ok: true,
            data: { items: [promotion], meta: { activeCount: 1, maxActive: 5 } }
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

        expect(await screen.findByText('Oferta')).toBeInTheDocument();
    });

    describe('audience (HOS-2589)', () => {
        const vipPromotion = {
            ...promotion,
            description: 'Con la cena',
            window: null,
            touristAudience: 'vip',
            vipPausedAt: null
        };

        function renderManager() {
            render(
                <VenuePromotionsManager
                    listingId="venue-id"
                    locale="es"
                    sectionState="available"
                    upsellPlanName={null}
                    limitPlanOptions={[]}
                    freeQuota={3}
                    vipPlanName="Viajero VIP"
                />
            );
        }

        it('AC-1/AC-25: «Para todos» by default; «Solo VIP» locked without the key', async () => {
            mocks.list.mockResolvedValue({
                ok: true,
                data: { items: [], meta: { activeCount: 0, maxActive: 5 } }
            });
            renderManager();
            fireEvent.click(await screen.findByRole('button', { name: 'Agregar promoción' }));
            expect(screen.getByRole('radio', { name: /plusLabel/ })).toBeChecked();
            expect(screen.getByText(/plusDescription_other/)).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /vipLabel/ })).toBeDisabled();
            expect(screen.getByTestId('promotion-audience-vip-locked')).toBeInTheDocument();
        });

        it('AC-2: saving «Para todos» on a «Solo VIP» promotion stores plus', async () => {
            entitlements.read.mockResolvedValue({
                entitlements: { vip_only_promotions: 1 },
                limits: {},
                failed: false
            });
            mocks.list.mockResolvedValue({
                ok: true,
                data: { items: [vipPromotion], meta: { activeCount: 1, maxActive: 5 } }
            });
            mocks.update.mockResolvedValue({ ok: true, data: vipPromotion });
            renderManager();
            fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
            expect(screen.getByRole('radio', { name: /vipLabel/ })).toBeChecked();
            fireEvent.click(screen.getByRole('radio', { name: /plusLabel/ }));
            fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
            await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
            expect(mocks.update.mock.calls[0]?.[0].body.touristAudience).toBe('plus');
        });

        it('D-8: an unchanged «Solo VIP» is not re-sent', async () => {
            mocks.list.mockResolvedValue({
                ok: true,
                data: { items: [vipPromotion], meta: { activeCount: 1, maxActive: 5 } }
            });
            mocks.update.mockResolvedValue({ ok: true, data: vipPromotion });
            renderManager();
            fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
            fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
            await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
            expect(mocks.update.mock.calls[0]?.[0].body).not.toHaveProperty('touristAudience');
        });

        it('AC-36: shows the in-app notice for promotions the pause holds', async () => {
            mocks.list.mockResolvedValue({
                ok: true,
                data: {
                    items: [
                        {
                            ...vipPromotion,
                            lifecycleState: 'INACTIVE',
                            vipPausedAt: '2026-11-24T12:20:00.000Z'
                        }
                    ],
                    meta: { activeCount: 0, maxActive: 5 }
                }
            });
            renderManager();
            expect(await screen.findByText('host.promotions.vipPaused.title')).toBeInTheDocument();
            expect(screen.getByText(/host.promotions.vipPaused.body/)).toBeInTheDocument();
        });
    });
});
