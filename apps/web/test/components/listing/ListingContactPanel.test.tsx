import { CreateConversationAnonSchema } from '@repo/schemas';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileBookingSummaryActions } from '@/components/accommodation/MobileBookingSummaryActions.client';
import { ListingContactBar } from '@/components/listing/contact/ListingContactBar.client';
import { ListingContactPanel } from '@/components/listing/contact/ListingContactPanel.client';
import { resetDialogHistoryForTests } from '@/lib/dialog-history';
import { markRouterAgrees } from '@/lib/dialog-history.router-sync';
import { createTranslations } from '@/lib/i18n';
import { buildInquiryMessage } from '@/lib/listing-contact/build-inquiry-message';
import { openListingContactPanel } from '@/lib/listing-contact/listing-contact-events';
import { __setNavigateImpl } from '../../stubs/astro-transitions-client';
import { props } from './listing-contact-panel-fixture';

const { getWhatsApp, trackEvent, conversation } = vi.hoisted(() => ({
    conversation: { conversationId: null as string | null },
    getWhatsApp: vi.fn(),
    trackEvent: vi.fn()
}));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));
vi.mock('@/lib/listing-contact/build-inquiry-message', { spy: true });
vi.mock('@/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({ user: null })
}));
vi.mock('@/store/accommodation-conversation-store', () => ({
    useAccommodationConversation: () => conversation
}));
vi.mock('@/lib/api/endpoints-protected', () => ({ protectedAccommodationsApi: { getWhatsApp } }));

const { t } = createTranslations('es');

function openPanel() {
    act(() => openListingContactPanel({ origin: 'bar' }));
    return screen.getByRole('dialog');
}

function fillGuestIdentity({ dialog }: { readonly dialog: ReturnType<typeof within> }) {
    fireEvent.change(dialog.getByRole('textbox', { name: /^Nombre/ }), {
        target: { value: 'Ana' }
    });
    fireEvent.change(dialog.getByRole('textbox', { name: /^Email|^Correo/ }), {
        target: { value: 'ana@example.test' }
    });
}

function fillEditedInquiry() {
    const dialog = within(openPanel());
    fireEvent.change(dialog.getByLabelText('Llegada'), { target: { value: '2027-01-09' } });
    fireEvent.change(dialog.getByLabelText('Salida'), { target: { value: '2027-01-11' } });
    fireEvent.input(dialog.getByLabelText('Huéspedes'), { target: { value: '4' } });
    fillGuestIdentity({ dialog });
    fireEvent.change(dialog.getByRole('textbox', { name: /^Mensaje/ }), {
        target: { value: 'Mi consulta personal' }
    });
    return dialog;
}

describe('ListingContactPanel', () => {
    it('names the host and puts the public icon shortcuts before the form, then the plans link', () => {
        render(
            <ListingContactPanel
                {...props}
                hasWhatsapp
                phone="+543442123456"
                email="ana@example.test"
            />
        );
        const sheet = openPanel();
        const dialog = within(sheet);
        const phone = dialog.getByRole('link', { name: 'Llamar' });
        const email = dialog.getByRole('link', { name: 'Email' });
        const field = dialog.getByLabelText('Llegada');
        const plans = dialog.getByRole('link', { name: 'Ver planes' });

        expect.soft(sheet).toHaveAccessibleName('Consultá al anfitrión: Ana');
        expect.soft(phone.querySelector('svg')).not.toBeNull();
        expect.soft(email.querySelector('svg')).not.toBeNull();
        expect.soft(phone.className).toBe(email.className);
        expect
            .soft(phone.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING)
            .toBeTruthy();
        expect(
            field.compareDocumentPosition(plans) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });
    afterEach(() => {
        conversation.conversationId = null;
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('shows the thread action without orphaned booking fields for an existing conversation', () => {
        conversation.conversationId = 'thread-1';
        render(<ListingContactPanel {...props} />);
        const dialog = within(openPanel());
        expect(dialog.queryByLabelText('Llegada')).not.toBeInTheDocument();
        expect(dialog.queryByLabelText('Huéspedes')).not.toBeInTheDocument();
        expect(dialog.getByRole('link', { name: 'Ver conversación' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/consultas/thread-1/'
        );
    });

    it.each([
        'Escape',
        'backdrop'
    ] as const)('opens outside the dock, starts on the close control, and returns focus after %s', async (dismissal) => {
        render(
            <>
                <div data-mobile-dock>
                    <button type="button">Trigger</button>
                </div>
                <ListingContactPanel {...props} />
            </>
        );
        const trigger = screen.getByRole('button', { name: 'Trigger' });
        trigger.focus();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        const dialog = openPanel();

        expect(dialog).toHaveAttribute('data-variant', 'sheet');
        expect(dialog.closest('[data-mobile-dock]')).toBeNull();
        expect(within(dialog).getByText(/155\.500/)).toBeInTheDocument();
        expect(within(dialog).getByText(/Sin comisiones/)).toBeInTheDocument();
        await waitFor(() =>
            expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toHaveFocus()
        );

        if (dismissal === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
        else fireEvent.click(screen.getByRole('presentation'));

        expect(dialog).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it.each([
        'Escape',
        'backdrop'
    ] as const)('restores the entire edited inquiry after %s', (dismissal) => {
        render(<ListingContactPanel {...props} />);
        fillEditedInquiry();

        if (dismissal === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
        else fireEvent.click(screen.getByRole('presentation'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        const dialog = within(openPanel());

        expect(dialog.getByLabelText('Llegada')).toHaveValue('2027-01-09');
        expect(dialog.getByLabelText('Salida')).toHaveValue('2027-01-11');
        expect(dialog.getByLabelText('Huéspedes')).toHaveValue(4);
        expect(dialog.getByRole('textbox', { name: /^Nombre/ })).toHaveValue('Ana');
        expect(dialog.getByRole('textbox', { name: /^Email|^Correo/ })).toHaveValue(
            'ana@example.test'
        );
        fireEvent.input(dialog.getByLabelText('Huéspedes'), { target: { value: '3' } });
        expect(dialog.getByRole('textbox', { name: /^Mensaje/ })).toHaveValue(
            'Mi consulta personal'
        );
    });

    it('resets the inquiry when the same island renders another listing', () => {
        const { rerender } = render(<ListingContactPanel {...props} />);
        fillEditedInquiry();

        rerender(
            <ListingContactPanel
                {...props}
                accommodation={{
                    ...props.accommodation,
                    id: '04c13742-a25d-4c9d-8bf7-add1add1add2'
                }}
            />
        );
        const dialog = within(openPanel());

        expect(dialog.getByLabelText('Llegada')).toHaveValue('');
        expect(dialog.getByLabelText('Salida')).toHaveValue('');
        expect(dialog.getByLabelText('Huéspedes')).toHaveDisplayValue('');
        expect(dialog.getByRole('textbox', { name: /^Nombre/ })).toHaveValue('');
        expect(dialog.getByRole('textbox', { name: /^Mensaje/ })).toHaveValue(
            t('conversations.form.prefill.intro')
        );
    });

    it('restores the draft after browser Back dismisses the sheet', async () => {
        const url = window.location.href;
        const state = window.history.state;
        const meta = document.createElement('meta');
        meta.name = 'astro-view-transitions-enabled';
        document.head.append(meta);
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', url);
        markRouterAgrees();
        __setNavigateImpl((href, options) => {
            const claim = options as { readonly state: Record<string, unknown> };
            window.history.pushState(
                { ...claim.state, index: 1, scrollX: 0, scrollY: 0 },
                '',
                href
            );
        });
        const { unmount } = render(<ListingContactPanel {...props} />);

        try {
            fillEditedInquiry();
            await waitFor(() => expect(window.location.hash).toMatch(/^#hospeda-dialog-/));
            await act(async () => {
                const popped = new Promise<void>((resolve) => {
                    window.addEventListener('popstate', () => resolve(), { once: true });
                });
                window.history.back();
                await popped;
            });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(window.location.href).toBe(url);
            const dialog = within(openPanel());
            expect(dialog.getByLabelText('Huéspedes')).toHaveValue(4);
            expect(dialog.getByRole('textbox', { name: /^Mensaje/ })).toHaveValue(
                'Mi consulta personal'
            );
        } finally {
            unmount();
            meta.remove();
            __setNavigateImpl(null);
            resetDialogHistoryForTests();
            window.history.replaceState(state, '', url);
        }
    });

    it.each([
        false,
        true
    ])('keeps a pending send across dismissal (new edits: %s)', async (edited) => {
        const response = Promise.withResolvers<Response>();
        const fetchMock = vi.fn().mockReturnValue(response.promise);
        vi.stubGlobal('fetch', fetchMock);
        render(<ListingContactPanel {...props} />);
        const submitName = t('conversations.form.submit');
        fireEvent.click(fillEditedInquiry().getByRole('button', { name: submitName }));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        const panel = within(openPanel());
        const submit = panel.getByRole('button', { busy: true });
        const message = panel.getByRole('textbox', { name: /^Mensaje/ });
        if (edited) fireEvent.change(message, { target: { value: 'Una consulta nueva' } });
        const form = submit.closest('form');
        if (!form) throw new Error('Inquiry form is missing');
        fireEvent.submit(form);

        expect(submit).toBeDisabled();
        expect(fetchMock).toHaveBeenCalledOnce();
        await act(async () => response.resolve(new Response('{}')));
        expect(panel.getByText(t('conversations.notifications.verificationSent'))).toBeVisible();
        if (edited) {
            expect(message).toHaveValue('Una consulta nueva');
            expect(panel.getByLabelText('Llegada')).toHaveValue('2027-01-09');
            expect(panel.getByRole('button', { name: submitName })).toBeEnabled();
        } else {
            expect(submit).not.toBeInTheDocument();
            expect(panel.getByLabelText('Llegada')).toHaveValue('');
            expect(panel.getByLabelText('Huéspedes')).toHaveDisplayValue('');
        }
        fireEvent.keyDown(document, { key: 'Escape' });
        const reopened = within(openPanel());
        expect(reopened.getByLabelText('Salida')).toHaveValue(edited ? '2027-01-11' : '');
        expect(reopened.getByRole('textbox', { name: /^Nombre/ })).toHaveValue(edited ? 'Ana' : '');
        expect(reopened.getByRole('textbox', { name: /^Email|^Correo/ })).toHaveValue(
            edited ? 'ana@example.test' : ''
        );
        expect(reopened.getByRole('textbox', { name: /^Mensaje/ })).toHaveValue(
            edited ? 'Una consulta nueva' : t('conversations.form.prefill.intro')
        );
    });

    it('keeps both summary links as fallbacks until the panel is ready, then opens by keyboard', async () => {
        const user = userEvent.setup();
        const summary = (
            <MobileBookingSummaryActions
                listingId={props.accommodation.id}
                panelId={props.panelId}
                locale="es"
                hasWhatsapp
            />
        );
        const fallback = <>{summary}</>;
        const { rerender } = render(fallback);
        const links = screen.getAllByRole('link');
        const trigger = screen.getByRole('link', { name: 'Consultar' });

        for (const link of links) {
            expect(link).toHaveAttribute('href', '#contact');
            expect(link).not.toHaveAttribute('aria-haspopup');
            expect(fireEvent.click(link)).toBe(true);
        }
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        rerender(
            <>
                {summary}
                <ListingContactPanel {...props} />
            </>
        );
        for (const link of links) expect(link).toHaveAttribute('aria-haspopup', 'dialog');
        trigger.focus();
        await user.keyboard('{Enter}');

        const dialog = within(screen.getByRole('dialog'));
        const arrival = dialog.getByLabelText('Llegada');
        await waitFor(() => {
            const region = dialog.getByRole('region', { name: 'Consultar' });
            expect(region).toHaveFocus();
            expect(region).toContainElement(arrival);
        });

        rerender(fallback);
        for (const link of links) expect(link).not.toHaveAttribute('aria-haspopup');
    });

    it('AC-30 (HOS-2579): opens from the bar WhatsApp action and focuses its anonymous upsell without a lookup', async () => {
        render(
            <>
                <div data-mobile-dock>
                    <div data-mobile-dock-slot="contact" />
                </div>
                <ListingContactBar
                    listingId={props.accommodation.id}
                    listingName="Casa del Río"
                    price={props.price}
                    locale="es"
                    vertical="accommodation"
                    primary={{ kind: 'inquire' }}
                    hasWhatsapp
                    phoneHref={null}
                    shareUrl="https://hospeda.test/es/alojamientos/casa-del-rio/"
                    panelId={props.panelId}
                />
                <ListingContactPanel
                    {...props}
                    hasWhatsapp
                />
            </>
        );

        const trigger = screen.getByRole('link', { name: 'Escribir por WhatsApp' });
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
        trigger.focus();
        await userEvent.setup().keyboard('{Enter}');

        const dialog = within(screen.getByRole('dialog'));
        const upsell = dialog.getByRole('link', { name: 'Ver planes' });
        await waitFor(() => {
            const region = dialog.getByRole('region', { name: 'WhatsApp' });
            expect(region).toHaveFocus();
            expect(region).toContainElement(upsell);
        });
        expect(getWhatsApp).not.toHaveBeenCalled();
    });

    it('builds and tracks shortcuts for public phone and email only', () => {
        render(
            <ListingContactPanel
                {...props}
                phone="+54 (3442) 123-456"
                email="ana@example.test"
            />
        );

        const dialog = within(openPanel());
        const phone = dialog.getByRole('link', { name: 'Llamar' });
        const email = dialog.getByRole('link', { name: 'Email' });
        for (const [link, channel] of [
            [phone, 'phone'],
            [email, 'email']
        ] as const) {
            link.addEventListener('click', (event) => event.preventDefault(), { once: true });
            fireEvent.click(link);
            expect(trackEvent).toHaveBeenLastCalledWith(
                'listing_contact_clicked',
                expect.objectContaining({ channel, origin: 'panel' })
            );
        }

        expect(phone).toHaveAttribute('href', 'tel:+543442123456');
        expect(email).toHaveAttribute('href', 'mailto:ana@example.test');
        expect(dialog.queryByRole('link', { name: 'Ver planes' })).not.toBeInTheDocument();
    });

    it('keeps validating booking fields without rebuilding the draft after a visitor edit', () => {
        render(<ListingContactPanel {...props} />);
        const dialog = within(openPanel());
        const arrival = dialog.getByLabelText('Llegada');
        const departure = dialog.getByLabelText('Salida');
        const guests = dialog.getByRole('spinbutton', { name: 'Huéspedes' });
        const message = dialog.getByRole('textbox', { name: /^Mensaje/ });

        fireEvent.change(arrival, { target: { value: '2027-01-09' } });
        fireEvent.change(departure, { target: { value: '2027-01-08' } });
        fireEvent.input(guests, { target: { value: '5' } });

        expect(dialog.queryAllByRole('link')).toHaveLength(0);
        expect(guests).toHaveAttribute('max', '4');
        expect(departure).toHaveAccessibleDescription(
            'La salida tiene que ser después de la llegada'
        );
        expect(guests).toHaveAccessibleDescription(/entre 1 y 4/);
        expect(message).toHaveValue('Hola, ¿está disponible a partir del 9/1?');

        fireEvent.change(message, { target: { value: 'Mi consulta personal' } });
        vi.mocked(buildInquiryMessage).mockClear();
        fireEvent.change(departure, { target: { value: '2027-01-11' } });
        fireEvent.input(guests, { target: { value: '4' } });

        expect(dialog.queryByRole('alert')).not.toBeInTheDocument();
        expect(message).toHaveValue('Mi consulta personal');
        expect(buildInquiryMessage).not.toHaveBeenCalled();

        fireEvent.change(departure, { target: { value: '2027-01-08' } });
        expect(departure).toHaveAttribute('aria-invalid', 'true');
        expect(buildInquiryMessage).not.toHaveBeenCalled();
    });

    it.each([
        ['Salida', '2027-01-08'],
        ['Huéspedes', '5']
    ])('blocks an auto-generated inquiry while %s is invalid and allows sending after clearing it', async (label, invalidValue) => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
        render(<ListingContactPanel {...props} />);
        const dialog = within(openPanel());
        const submit = dialog.getByRole('button', { name: t('conversations.form.submit') });
        const form = submit.closest('form');
        if (!form) throw new Error('Inquiry form is missing');
        fillGuestIdentity({ dialog });
        fireEvent.change(dialog.getByLabelText('Llegada'), { target: { value: '2027-01-09' } });
        fireEvent.change(dialog.getByLabelText('Salida'), { target: { value: '2027-01-11' } });
        const message = dialog.getByRole('textbox', { name: /^Mensaje/ });
        const invalidField = dialog.getByLabelText(label);

        const changeField = label === 'Huéspedes' ? fireEvent.input : fireEvent.change;
        changeField(invalidField, { target: { value: invalidValue } });
        await act(async () => fireEvent.submit(form));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(submit).toBeDisabled();
        expect(message).toHaveValue('Hola, ¿está disponible del 9/1 al 11/1?');

        changeField(invalidField, { target: { value: '' } });
        expect(submit).toBeEnabled();
        await act(async () => fireEvent.click(submit));
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it.each([
        ['Huéspedes', false, /entre 1 y 4/],
        ['Llegada', true, t('accommodations.detail.listingContact.errors.invalidDate')],
        ['Llegada', false, t('accommodations.detail.listingContact.errors.invalidDate')],
        ['Salida', true, t('accommodations.detail.listingContact.errors.invalidDate')],
        ['Salida', false, t('accommodations.detail.listingContact.errors.invalidDate')]
    ])('blocks incomplete %s (input event: %s) without replacing the last draft', async (label, dispatchInput, description) => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
        render(<ListingContactPanel {...props} />);
        const dialog = within(openPanel());
        await waitFor(() => expect(dialog.getByRole('button', { name: 'Cerrar' })).toHaveFocus());
        const field = dialog.getByLabelText<HTMLInputElement>(label);
        const submit = dialog.getByRole('button', { name: t('conversations.form.submit') });
        const form = submit.closest('form');
        if (!form) throw new Error('Inquiry form is missing');
        fillGuestIdentity({ dialog });
        fireEvent.change(dialog.getByLabelText('Llegada'), { target: { value: '2027-01-09' } });
        fireEvent.change(dialog.getByLabelText('Salida'), { target: { value: '2027-01-11' } });
        const message = dialog.getByRole('textbox', { name: /^Mensaje/ });
        let badInput = true;
        const validity = field.validity;
        Object.defineProperty(field, 'validity', {
            get: () => (badInput ? { badInput: true } : validity)
        });
        expect(submit).toBeEnabled();

        field.value = '';
        if (dispatchInput) {
            fireEvent.input(field);
            expect(field).toHaveAccessibleDescription(description);
            expect(submit).toBeDisabled();
        }
        await act(async () => fireEvent.submit(form));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(field).toHaveDisplayValue('');
        expect(field).toHaveFocus();
        expect(field).toHaveAccessibleDescription(description);
        expect(submit).toBeDisabled();
        expect(message).toHaveValue('Hola, ¿está disponible del 9/1 al 11/1?');

        badInput = false;
        fireEvent.input(field);
        if (label === 'Huéspedes') expect(field).not.toHaveAccessibleDescription();
        else
            expect(field).toHaveAccessibleDescription(
                label === 'Llegada' ? 'Elegí la llegada' : 'Elegí la salida'
            );
        expect(submit).toBeEnabled();
        await act(async () => fireEvent.click(submit));
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('submits a valid anonymous inquiry with dates and guests as fields and in the message', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
        render(<ListingContactPanel {...props} />);
        const dialog = within(openPanel());

        fireEvent.change(dialog.getByLabelText('Llegada'), { target: { value: '2027-01-09' } });
        fireEvent.change(dialog.getByLabelText('Salida'), { target: { value: '2027-01-11' } });
        fireEvent.input(dialog.getByLabelText('Huéspedes'), { target: { value: '4' } });
        fillGuestIdentity({ dialog });
        await act(async () =>
            fireEvent.click(dialog.getByRole('button', { name: t('conversations.form.submit') }))
        );

        expect(fetchMock).toHaveBeenCalledOnce();
        const [endpoint, options] = fetchMock.mock.calls[0];
        const body: unknown = JSON.parse(options.body);
        expect(endpoint).toMatch(/\/api\/v1\/public\/conversations\/initiate$/);
        expect(CreateConversationAnonSchema.safeParse(body).success).toBe(true);
        expect(body).toEqual({
            accommodationId: props.accommodation.id,
            guestName: 'Ana',
            guestEmail: 'ana@example.test',
            message: 'Hola, ¿está disponible del 9/1 al 11/1 para 4 personas?',
            checkIn: '2027-01-09',
            checkOut: '2027-01-11',
            guests: 4
        });
    });

    it('sends only the booking fields the visitor filled (HOS-2534)', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
        render(<ListingContactPanel {...props} />);
        const dialog = within(openPanel());

        fireEvent.input(dialog.getByLabelText('Huéspedes'), { target: { value: '2' } });
        fillGuestIdentity({ dialog });
        await act(async () =>
            fireEvent.click(dialog.getByRole('button', { name: t('conversations.form.submit') }))
        );

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.guests).toBe(2);
        expect(body).not.toHaveProperty('checkIn');
        expect(body).not.toHaveProperty('checkOut');
        expect(CreateConversationAnonSchema.safeParse(body).success).toBe(true);
    });

    it('sends no booking fields when the visitor filled none (HOS-2534)', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
        render(<ListingContactPanel {...props} />);
        const dialog = within(openPanel());

        fillGuestIdentity({ dialog });
        await act(async () =>
            fireEvent.click(dialog.getByRole('button', { name: t('conversations.form.submit') }))
        );

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body).not.toHaveProperty('checkIn');
        expect(body).not.toHaveProperty('checkOut');
        expect(body).not.toHaveProperty('guests');
    });
});
