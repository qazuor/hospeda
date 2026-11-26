/**
 * @file ListingContactCard.test.tsx
 * @description HOS-2531 (AC-2.7): the desktop sidebar card feeds the inquiry through the
 * same message builder as the mobile sheet and shows the "contact directly" row.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CreateConversationAnonSchema } from '@repo/schemas';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ListingContactCard,
    type ListingContactCardProps
} from '@/components/listing/contact/ListingContactCard.client';
import { createTranslations } from '@/lib/i18n';
import { buildInquiryMessage } from '@/lib/listing-contact/build-inquiry-message';

const { getWhatsApp, trackEvent, conversation, session } = vi.hoisted(() => ({
    session: { user: null as { id: string } | null },
    conversation: { conversationId: null as string | null },
    getWhatsApp: vi.fn(),
    trackEvent: vi.fn()
}));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));
vi.mock('@/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => session
}));
vi.mock('@/store/accommodation-conversation-store', () => ({
    useAccommodationConversation: () => conversation
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
    it('uses a solid readable disabled state and 44px shortcut targets', () => {
        const css = (path: string) =>
            readFileSync(resolve(__dirname, '../../../src/components', path), 'utf8');
        const disabled = css('accommodation/ContactHost.module.css').match(
            /\.submitButton:disabled\s*\{[^}]+\}/
        )?.[0];

        expect.soft(disabled).toContain('color: var(--core-foreground)');
        expect.soft(disabled).toContain('background-color: var(--muted)');
        expect.soft(disabled).not.toContain('opacity');
        expect
            .soft(css('listing/contact/ListingInquiryLayout.module.css'))
            .toMatch(/\.shortcut\s*\{[^}]*min-block-size: 44px/);
        expect(css('accommodation/WhatsAppContact.module.css')).toMatch(
            /\.gateLine,[^}]*color: var\(--core-foreground\)/
        );
    });
    afterEach(() => {
        conversation.conversationId = null;
        session.user = null;
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it.each([
        'guest',
        'free'
    ])('puts the compact WhatsApp plans link after the %s form', async (viewer) => {
        if (viewer === 'free') session.user = { id: 'free' };
        getWhatsApp.mockResolvedValue({ ok: true, data: { number: null, entitled: false } });
        render(
            <ListingContactCard
                {...baseProps}
                hasWhatsapp
                gatePlanNames={['Catalog plan']}
            />
        );

        const gate = await screen.findByRole('region', { name: 'WhatsApp' });
        expect(
            message().compareDocumentPosition(gate) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(within(gate).queryByRole('heading')).not.toBeInTheDocument();
        expect(gate).toHaveTextContent('Ver el WhatsApp del anfitrión · Ver planes');
        expect(within(gate).getByRole('link')).toHaveAccessibleDescription('Catalog plan');
    });

    it('puts direct WhatsApp before the form with the number and the exact encoded preview', async () => {
        session.user = { id: 'entitled' };
        const number = '+54 9 3442 123456';
        getWhatsApp.mockResolvedValue({ ok: true, data: { number, direct: true, entitled: true } });
        render(
            <ListingContactCard
                {...baseProps}
                hasWhatsapp
                phone="+543442123456"
            />
        );

        const link = await screen.findByRole('link', { name: 'Consultar por WhatsApp' });
        expect
            .soft(link.compareDocumentPosition(message()) & Node.DOCUMENT_POSITION_FOLLOWING)
            .toBeTruthy();
        expect.soft(link).toHaveAccessibleDescription(expect.stringContaining(number));
        const preview = new URL(link.getAttribute('href') ?? '').searchParams.get('text');
        expect(preview).toContain(baseProps.accommodationName);
        expect.soft(screen.queryByText(preview ?? '')).toBeVisible();
        expect(
            screen.getByRole('button', { name: 'Enviar mensaje' }).closest('[data-secondary]')
        ).not.toBeNull();
    });

    it('selects the prefill but leaves visitor edits alone on refocus', () => {
        render(<ListingContactCard {...baseProps} />);
        const textarea = message();
        textarea.setSelectionRange(0, 0);

        fireEvent.focus(textarea);
        expect(textarea.selectionEnd).toBe(textarea.value.length);
        fireEvent.change(textarea, { target: { value: 'Personal message' } });
        textarea.setSelectionRange(2, 2);
        fireEvent.focus(textarea);
        expect(textarea.selectionEnd).toBe(2);
    });

    it('lists only missing required fields and shows the counter from 90% onward', () => {
        render(<ListingContactCard {...baseProps} />);
        const button = screen.getByRole('button', { name: 'Enviar mensaje' });

        expect(button).toBeDisabled();
        expect.soft(button).toHaveAccessibleDescription(/Nombre.*Email|Nombre.*Correo/);
        expect(button).not.toHaveAccessibleDescription(/Mensaje/);
        fireEvent.change(screen.getByRole('textbox', { name: /^Nombre/ }), {
            target: { value: 'Ana' }
        });
        expect(button).not.toHaveAccessibleDescription(/Nombre/);
        fireEvent.change(message(), { target: { value: 'a'.repeat(4499) } });
        expect(screen.queryByText(/\/5000 caracteres/)).not.toBeInTheDocument();
        fireEvent.change(message(), { target: { value: 'a'.repeat(4500) } });
        expect(message()).toHaveAccessibleDescription('4500/5000 caracteres');
    });

    it('renders the three booking fields next to the host form', () => {
        render(<ListingContactCard {...baseProps} />);

        expect(screen.getByLabelText('Llegada')).toBeInTheDocument();
        expect(screen.getByLabelText('Salida')).toBeInTheDocument();
        expect(screen.getByLabelText('Huéspedes')).toBeInTheDocument();
        expect(message().value).toBe(buildInquiryMessage({ locale: 'es' }).message);
        expect(screen.getByLabelText('Huéspedes')).toHaveAttribute(
            'placeholder',
            'Cantidad de huéspedes'
        );
        expect(screen.getByLabelText('Huéspedes')).toHaveAttribute('min', '1');
        expect(screen.getByLabelText('Huéspedes')).toHaveAttribute('max', '4');
        expect(screen.getByLabelText('Llegada')).toHaveAccessibleDescription('Elegí la llegada');
    });

    it('replaces the whole inquiry form with an existing-conversation state', () => {
        conversation.conversationId = 'thread-1';
        render(<ListingContactCard {...baseProps} />);
        expect(screen.queryByLabelText('Llegada')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Huéspedes')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: /^Mensaje/ })).not.toBeInTheDocument();
        expect(
            screen.getByText('Ya tenés una conversación con este anfitrión.')
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver conversación' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/consultas/thread-1/'
        );
        expect(screen.getByRole('link', { name: 'Ver conversación' })).toHaveClass(
            'btn-gradient--flat'
        );
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

            expect(screen.queryByRole('region', { name: 'WhatsApp' })).toBeNull();
        });

        it('offers a tel: link when the listing has a phone', () => {
            render(
                <ListingContactCard
                    {...baseProps}
                    phone="+54 3442 12-3456"
                />
            );

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
            expect(screen.queryByRole('region', { name: 'WhatsApp' })).toBeNull();

            rerender(
                <ListingContactCard
                    {...baseProps}
                    hasWhatsapp
                />
            );
            expect(screen.getByRole('region', { name: 'WhatsApp' })).toBeInTheDocument();
        });
    });
});
