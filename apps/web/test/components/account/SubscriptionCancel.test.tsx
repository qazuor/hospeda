import { CancellationReasonEnum } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionCancel } from '@/components/account/SubscriptionCancel.client';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: { cancellationPreview: vi.fn(), cancel: vi.fn() }
}));
beforeEach(() => vi.clearAllMocks());

const id = '123e4567-e89b-42d3-a456-426614174000';
describe('SubscriptionCancel island', () => {
    it('shows the preview and submits once in two clicks', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'ACTIVE',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        vi.mocked(billingSubscriptionApi.cancel).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                outcome: 'SCHEDULED',
                serviceEndsAt: '2026-11-05T03:00:00.000Z'
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Gastronomía"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        await screen.findByTestId('self-cancel-end');
        expect(screen.getByTestId('self-cancel-end')).toHaveTextContent('5 de noviembre de 2026');
        expect(screen.queryByText(/complementos recurrentes/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('self-cancel-confirm'));
        await waitFor(() => expect(screen.getByTestId('self-cancel-done')).toBeInTheDocument());
        expect(billingSubscriptionApi.cancel).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('¿Estás seguro?')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
    it('TEST:1878:24a shows an optional localized reason and omits it when unchanged', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'ACTIVE',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        vi.mocked(billingSubscriptionApi.cancel).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                outcome: 'SCHEDULED',
                serviceEndsAt: '2026-11-05T03:00:00.000Z'
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Alojamiento"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        const select = await screen.findByTestId('self-cancel-reason');
        expect(screen.getByLabelText('¿Por qué cancelás? (opcional)')).toBe(select);
        expect(
            Array.from((select as HTMLSelectElement).options)
                .slice(1)
                .map((option) => option.value)
        ).toEqual(Object.values(CancellationReasonEnum));
        fireEvent.click(screen.getByTestId('self-cancel-confirm'));
        await waitFor(() =>
            expect(billingSubscriptionApi.cancel).toHaveBeenCalledWith({ subscriptionId: id })
        );
    });
    it('TEST:1878:24a sends the selected reason and hides the selector for an already scheduled cancellation', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'ACTIVE',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        vi.mocked(billingSubscriptionApi.cancel).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                outcome: 'SCHEDULED',
                serviceEndsAt: '2026-11-05T03:00:00.000Z'
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Alojamiento"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        const selector = await screen.findByTestId('self-cancel-reason');
        fireEvent.change(selector, { target: { value: CancellationReasonEnum.SEASONAL_PAUSE } });
        fireEvent.click(screen.getByTestId('self-cancel-confirm'));
        await waitFor(() =>
            expect(billingSubscriptionApi.cancel).toHaveBeenCalledWith({
                subscriptionId: id,
                reason: CancellationReasonEnum.SEASONAL_PAUSE
            })
        );
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'CANCEL_SCHEDULED',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Alojamiento"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        await screen.findByTestId('self-cancel-end');
        expect(screen.queryByTestId('self-cancel-reason')).not.toBeInTheDocument();
    });
    it('fails closed when preview is invalid', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {}
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Gastronomía"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        expect(await screen.findByText(/No pudimos leer qué pasa/)).toBeInTheDocument();
        expect(screen.queryByTestId('self-cancel-confirm')).not.toBeInTheDocument();
        expect(billingSubscriptionApi.cancel).not.toHaveBeenCalled();
    });

    it('says GRACE_PERIOD ends today, identifies the lost grace service, and shows its date', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'GRACE_PERIOD',
                graceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Gastronomía"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        const line = await screen.findByTestId('self-cancel-end');
        expect(line).toHaveTextContent('termina hoy');
        expect(line).toHaveTextContent('perdés el servicio');
        expect(line).toHaveTextContent('5 de noviembre de 2026');
    });

    it('shows the ended result for GRACE_PERIOD even when the API returns its service end instant', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'GRACE_PERIOD',
                graceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        vi.mocked(billingSubscriptionApi.cancel).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                outcome: 'CANCELLED',
                serviceEndsAt: '2026-11-05T03:00:00.000Z'
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Gastronomía"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        await screen.findByTestId('self-cancel-confirm');
        fireEvent.click(screen.getByTestId('self-cancel-confirm'));
        expect(await screen.findByTestId('self-cancel-done')).toHaveTextContent(
            'El servicio terminó hoy.'
        );
    });

    it('says SUSPENDED ends today without referring to the grace period', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'SUSPENDED',
                addons: []
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Gastronomía"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        const line = await screen.findByTestId('self-cancel-end');
        expect(line).toHaveTextContent('termina hoy');
        expect(line).not.toHaveTextContent('gracia');
    });

    it('lists recurring addon names, amounts, cycles, and all three shutdown timings', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'ACTIVE',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: [
                    {
                        addonInstanceId: '123e4567-e89b-42d3-a456-426614174001',
                        name: 'Posición destacada',
                        price: 25000,
                        currency: 'ARS',
                        cycle: 'monthly',
                        whenOff: 'CHARGE_CUT_TODAY'
                    },
                    {
                        addonInstanceId: '123e4567-e89b-42d3-a456-426614174002',
                        name: 'Galería extendida',
                        price: 50000,
                        currency: 'ARS',
                        cycle: 'quarterly',
                        whenOff: 'AT_SERVICE_END'
                    },
                    {
                        addonInstanceId: '123e4567-e89b-42d3-a456-426614174003',
                        name: 'Sello de calidad',
                        price: 75000,
                        currency: 'ARS',
                        cycle: 'annual',
                        whenOff: 'TODAY'
                    }
                ]
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Gastronomía"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        expect(await screen.findByText(/complementos recurrentes/)).toBeInTheDocument();
        expect(screen.getByText(/Posición destacada.*250,00 por mes/)).toBeInTheDocument();
        expect(screen.getByText(/se corta hoy.*5 de noviembre de 2026/)).toBeInTheDocument();
        expect(screen.getByText(/Galería extendida.*500,00 por trimestre/)).toBeInTheDocument();
        expect(
            screen.getByText(/esperando autorización o tiene un cobro pendiente/)
        ).toBeInTheDocument();
        expect(screen.getByText(/Sello de calidad.*750,00 por año/)).toBeInTheDocument();
        expect(screen.getByText(/Se apaga hoy con tu suscripción/)).toBeInTheDocument();
        expect(screen.getByText(/Si volvés, los contratás de nuevo/)).toBeInTheDocument();
    });

    it('maps a 409 act response to stateChanged', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'ACTIVE',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        vi.mocked(billingSubscriptionApi.cancel).mockResolvedValue({
            ok: false,
            error: { status: 409 }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Gastronomía"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        await screen.findByTestId('self-cancel-confirm');
        fireEvent.click(screen.getByTestId('self-cancel-confirm'));
        expect(
            await screen.findByText(/Tu suscripción cambió mientras la mirabas/)
        ).toBeInTheDocument();
    });

    it('TEST:1762:4 names the subscription and ties the confirmation to its heading', async () => {
        // Arrange
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'ACTIVE',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Gastronomía"
            />
        );

        // Act
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        const heading = await screen.findByTestId('self-cancel-heading');

        // Assert
        expect(heading).toHaveTextContent('Vas a dar de baja: Básico (Gastronomía)');
        expect(heading.textContent).toBe('Vas a dar de baja: Básico (Gastronomía)');
        const section = heading.closest('section');
        expect(section).not.toBeNull();
        expect(section?.getAttribute('aria-labelledby')).toBe(heading.id);
        expect(screen.getByTestId('self-cancel-confirm').getAttribute('aria-describedby')).toBe(
            heading.id
        );
        const end = screen.getByTestId('self-cancel-end');
        expect(
            heading.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('TEST:1762:4 gives each open confirmation its own heading id', async () => {
        // Arrange
        const otherId = '223e4567-e89b-42d3-a456-426614174000';
        vi.mocked(billingSubscriptionApi.cancellationPreview)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    subscriptionId: id,
                    vertical: 'accommodation',
                    paymentMethod: 'CARD',
                    origin: 'ACTIVE',
                    serviceEndsAt: '2026-11-05T03:00:00.000Z',
                    addons: []
                }
            } as never)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    subscriptionId: otherId,
                    vertical: 'venue',
                    paymentMethod: 'CARD',
                    origin: 'ACTIVE',
                    serviceEndsAt: '2026-11-05T03:00:00.000Z',
                    addons: []
                }
            } as never);
        render(
            <>
                <SubscriptionCancel
                    subscriptionId={id}
                    locale="es"
                    planName="Básico"
                    verticalLabel="Gastronomía"
                />
                <SubscriptionCancel
                    subscriptionId={otherId}
                    locale="es"
                    planName="Pro"
                    verticalLabel="Alojamiento"
                />
            </>
        );

        // Act
        const openButtons = screen.getAllByTestId('self-cancel-open');
        fireEvent.click(openButtons[0]);
        fireEvent.click(openButtons[1]);
        await waitFor(() => expect(screen.getAllByTestId('self-cancel-heading')).toHaveLength(2));

        // Assert
        const headings = screen.getAllByTestId('self-cancel-heading');
        expect(headings[0].id).not.toBe(headings[1].id);
    });
});
