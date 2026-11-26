import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishButton } from '@/components/host/PublishButton.client';

const publishMock = vi.hoisted(() => vi.fn());
const offersMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: { offers: offersMock }
}));

beforeEach(() => {
    vi.clearAllMocks();
    offersMock.mockResolvedValue({ ok: true, data: { items: [] } });
});

const CAP_OFFER = {
    productId: '11111111-1111-4111-8111-111111111111',
    addonVersionId: '22222222-2222-4222-8222-222222222222',
    slug: 'extra-accommodation',
    name: 'Propiedad extra',
    description: null,
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 500000,
    currency: 'ARS',
    compatibleVerticals: ['accommodation'],
    grantedKeys: ['max_accommodations'],
    scopeType: 'VERTICAL_SUBSCRIPTION',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    freeUnderGrantVerticals: []
};

const hitTheCap = async () => {
    publishMock.mockResolvedValue({
        ok: false,
        error: { status: 403, code: 'LIMIT_REACHED', message: 'Listing limit reached' }
    });
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: 'Publicar de nuevo' }));
    await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
    await screen.findByTestId('publish-limit-reached');
};

const renderButton = () =>
    render(
        <PublishButton
            listingId="listing-1"
            vertical="accommodation"
            locale="es"
            label="Publicar de nuevo"
            confirmTitle="Confirmar"
            confirmNote="Nota"
            confirmYes="Sí, publicar"
            confirmNo="Cancelar"
            errorText="Error genérico"
            subscriptionRequiredMessage="Necesitás un plan"
            subscriptionRequiredCta="Ver planes"
            missingRequirementsMessage="Faltan {{fields}}"
            missingRequirementsCta="Editar"
            affordance={{ kind: 'covered', canPublish: true, startsTrial: false, trialDays: null }}
            checkFailedText="No pudimos comprobar"
            confirmTrialNote="Trial"
            choosePlanLabel="Elegir plan"
        />
    );

describe('PublishButton plan cap (HOS-1977 review)', () => {
    it('answers 403 LIMIT_REACHED with the cap message and a plans link, not the generic error', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'LIMIT_REACHED', message: 'Listing limit reached' }
        });
        const user = userEvent.setup();
        renderButton();
        await user.click(screen.getByRole('button', { name: 'Publicar de nuevo' }));
        await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
        const notice = await screen.findByTestId('publish-limit-reached');
        expect(notice).toHaveTextContent(/alcanzaste el límite de publicaciones/i);
        expect(notice).toHaveTextContent(/Despublicá otra ficha o mejorá tu plan/);
        expect(screen.getByRole('link', { name: 'Mejorar mi plan' })).toHaveAttribute(
            'href',
            expect.stringContaining('/es/')
        );
        expect(screen.queryByText('Error genérico')).toBeNull();
    });

    it('also offers the catalog add-on that widens the cap when one exists (HOS-2632)', async () => {
        offersMock.mockResolvedValue({ ok: true, data: { items: [CAP_OFFER] } });
        await hitTheCap();
        const link = await screen.findByTestId('publish-limit-reached-addon');
        expect(link).toHaveAttribute('href', expect.stringContaining('#addons-accommodation'));
        expect(link).toHaveTextContent(/Propiedad extra/);
        expect(screen.getByRole('link', { name: 'Mejorar mi plan' })).toBeInTheDocument();
    });

    it('offers only the plan change when no add-on widens the cap', async () => {
        await hitTheCap();
        expect(offersMock).toHaveBeenCalled();
        expect(screen.queryByTestId('publish-limit-reached-addon')).toBeNull();
        expect(screen.getByRole('link', { name: 'Mejorar mi plan' })).toBeInTheDocument();
    });

    it('keeps the generic error for any other failure', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        const user = userEvent.setup();
        renderButton();
        await user.click(screen.getByRole('button', { name: 'Publicar de nuevo' }));
        await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
        expect(await screen.findByText('Error genérico')).toBeInTheDocument();
        expect(screen.queryByTestId('publish-limit-reached')).toBeNull();
    });
});
