/**
 * @file ListingContactCard.test.tsx
 * @description HOS-2531 (AC-2.7): the desktop sidebar card feeds the inquiry through the
 * same message builder as the mobile sheet and shows the "contact directly" row.
 */
import { CreateConversationAnonSchema } from '@repo/schemas';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ListingContactCard,
    type ListingContactCardProps
} from '@/components/listing/contact/ListingContactCard.client';
import { createTranslations } from '@/lib/i18n';
import { buildInquiryMessage } from '@/lib/listing-contact/build-inquiry-message';

const { getWhatsApp, trackEvent } = vi.hoisted(() => ({
    getWhatsApp: vi.fn(),
    trackEvent: vi.fn()
}));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));
vi.mock('@/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({ user: null })
}));
vi.mock('@/store/accommodation-conversation-store', () => ({
    useAccommodationConversation: () => ({ conversationId: null })
}));
vi.mock('@/lib/api/endpoints-protected', () => ({ protectedAccommodationsApi: { getWhatsApp } }));

const { t } = createTranslations('es');

const baseProps: ListingContactCardProps = {
    accommodation: {
        id: '04c13742-a25d-4c9d-8bf7-add1add1add1',
        deletedAt: null,
        type: 'HOUSE',
        destinationId: 'dest',
        destinationName: 'Colón',
        price: 155500,
        currency: 'ARS',
        ownerId: 'owner'
    },
    accommodationName: 'Casa del Río',
    hasWhatsapp: false,
    whatsappPlansHref: '/es/planes/turistas/precios/',
    capacity: 4,
    locale: 'es'
};

function message(): HTMLTextAreaElement {
    return screen.getByRole('textbox', { name: /^Mensaje/ }) as HTMLTextAreaElement;
}

describe('ListingContactCard', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('renders the three booking fields next to the host form', () => {
        render(<ListingContactCard {...baseProps} />);

        expect(screen.getByLabelText('Llegada')).toBeInTheDocument();
        expect(screen.getByLabelText('Salida')).toBeInTheDocument();
        expect(screen.getByLabelText('Huéspedes')).toBeInTheDocument();
        expect(message().value).toBe(buildInquiryMessage({ locale: 'es' }).message);
    });

    it('builds the message with buildInquiryMessage from dates and guests', () => {
        render(<ListingContactCard {...baseProps} />);

        fireEvent.change(screen.getByLabelText('Llegada'), { target: { value: '2027-01-09' } });
        fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '2027-01-11' } });
        fireEvent.change(screen.getByLabelText('Huéspedes'), { target: { value: '3' } });

        expect(message().value).toBe(
            buildInquiryMessage({
                locale: 'es',
                checkIn: '2027-01-09',
                checkOut: '2027-01-11',
                guests: 3,
                capacity: 4
            }).message
        );
        expect(message().value).toContain('9/1');
    });

    it('keeps the visitor edit when a field changes afterwards', () => {
        render(<ListingContactCard {...baseProps} />);

        fireEvent.change(message(), { target: { value: 'Mi consulta personal' } });
        fireEvent.change(screen.getByLabelText('Llegada'), { target: { value: '2027-01-09' } });

        expect(message().value).toBe('Mi consulta personal');
    });

    it('shows a field error and keeps the previous draft when the stay is invalid', () => {
        render(<ListingContactCard {...baseProps} />);

        fireEvent.change(screen.getByLabelText('Llegada'), { target: { value: '2027-01-11' } });
        const before = message().value;
        fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '2027-01-09' } });

        expect(
            screen.getByText(t('accommodations.detail.listingContact.errors.checkOutAfterCheckIn'))
        ).toBeInTheDocument();
        expect(message().value).toBe(before);
    });

    it('rejects a guest count above the capacity', () => {
        render(<ListingContactCard {...baseProps} />);

        fireEvent.change(screen.getByLabelText('Huéspedes'), { target: { value: '9' } });

        expect(
            screen.getByText(
                t('accommodations.detail.listingContact.errors.guestsRange', undefined, {
                    capacity: 4
                })
            )
        ).toBeInTheDocument();
    });

    it('uses the search-context message until a field is filled', () => {
        render(
            <ListingContactCard
                {...baseProps}
                initialMessage="Hola, estoy mirando del 9/1 al 11/1."
            />
        );
        expect(message().value).toBe('Hola, estoy mirando del 9/1 al 11/1.');
    });

    describe('structured inquiry fields (HOS-2534)', () => {
        function stubFetch() {
            const fetchMock = vi
                .fn()
                .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
            vi.stubGlobal('fetch', fetchMock);
            return fetchMock;
        }

        async function submitAsGuest() {
            fireEvent.change(screen.getByRole('textbox', { name: /^Nombre/ }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /^Email|^Correo/ }), {
                target: { value: 'ana@example.test' }
            });
            await act(async () =>
                fireEvent.click(
                    screen.getByRole('button', { name: t('conversations.form.submit') })
                )
            );
        }

        it('sends dates and guests as columns and in the message', async () => {
            const fetchMock = stubFetch();
            render(<ListingContactCard {...baseProps} />);

            fireEvent.change(screen.getByLabelText('Llegada'), { target: { value: '2027-01-09' } });
            fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '2027-01-11' } });
            fireEvent.change(screen.getByLabelText('Huéspedes'), { target: { value: '4' } });
            await submitAsGuest();

            expect(fetchMock).toHaveBeenCalledOnce();
            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(CreateConversationAnonSchema.safeParse(body).success).toBe(true);
            expect(body).toMatchObject({
                accommodationId: baseProps.accommodation.id,
                checkIn: '2027-01-09',
                checkOut: '2027-01-11',
                guests: 4
            });
            expect(body.message).toContain('9/1');
        });

        it('sends only the booking fields the visitor filled', async () => {
            const fetchMock = stubFetch();
            render(<ListingContactCard {...baseProps} />);

            fireEvent.change(screen.getByLabelText('Huéspedes'), { target: { value: '2' } });
            await submitAsGuest();

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.guests).toBe(2);
            expect(body).not.toHaveProperty('checkIn');
            expect(body).not.toHaveProperty('checkOut');
        });

        it('sends no booking fields when the visitor filled none', async () => {
            const fetchMock = stubFetch();
            render(<ListingContactCard {...baseProps} />);

            await submitAsGuest();

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body).not.toHaveProperty('checkIn');
            expect(body).not.toHaveProperty('checkOut');
            expect(body).not.toHaveProperty('guests');
        });

        it('sends no booking fields while they are invalid', async () => {
            const fetchMock = stubFetch();
            render(<ListingContactCard {...baseProps} />);

            fireEvent.change(screen.getByLabelText('Llegada'), { target: { value: '2027-01-11' } });
            fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '2027-01-09' } });
            fireEvent.change(message(), { target: { value: 'Consulta propia' } });
            await submitAsGuest();

            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body).not.toHaveProperty('checkIn');
            expect(body).not.toHaveProperty('checkOut');
        });
    });

    describe('contact directly row', () => {
        it('is absent when the listing has no phone and no WhatsApp', () => {
            render(<ListingContactCard {...baseProps} />);

            expect(screen.queryByText('O contactá directo')).toBeNull();
        });

        it('offers a tel: link when the listing has a phone', () => {
            render(
                <ListingContactCard
                    {...baseProps}
                    phone="+54 3442 12-3456"
                />
            );

            expect(screen.getByText('O contactá directo')).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Llamar' })).toHaveAttribute(
                'href',
                'tel:+543442123456'
            );
        });

        it('ignores a phone that is not dialable', () => {
            render(
                <ListingContactCard
                    {...baseProps}
                    phone="llamar de tarde"
                />
            );

            expect(screen.queryByRole('link', { name: 'Llamar' })).toBeNull();
        });

        it('mounts the entitlement-gated WhatsApp block only when the listing has WhatsApp', () => {
            const { rerender } = render(<ListingContactCard {...baseProps} />);
            expect(screen.queryByText('O contactá directo')).toBeNull();

            rerender(
                <ListingContactCard
                    {...baseProps}
                    hasWhatsapp
                />
            );
            expect(screen.getByText('O contactá directo')).toBeInTheDocument();
        });
    });
});
