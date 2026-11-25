/**
 * @file AllianceLead.test.tsx
 * @description RTL tests for the AllianceLead React island (HOS-277).
 *
 * Covers: generic + kind-specific field rendering per kind, required-field
 * validation (generic and kind-specific), honeypot presence, message
 * serialization on submit, posts to the alliance leads endpoint, success
 * state, 429 rate-limit message, and generic API errors.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllianceLead } from '../../../src/components/alliance/AllianceLead.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/alliance/AllianceLead.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const { mockReadCachedAuthMe, mockFetchAuthMe, mockWriteCachedAuthMe } = vi.hoisted(() => ({
    mockReadCachedAuthMe: vi.fn(),
    mockFetchAuthMe: vi.fn(),
    mockWriteCachedAuthMe: vi.fn()
}));

// The island resolves the visitor in the browser (HOS-278 AC-1). Mocked at the
// module boundary so the suite drives auth state without a network.
vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: mockReadCachedAuthMe,
    fetchAuthMe: mockFetchAuthMe,
    writeCachedAuthMe: mockWriteCachedAuthMe
}));

const { mockGetHostTradeCatalog } = vi.hoisted(() => ({ mockGetHostTradeCatalog: vi.fn() }));

// The category combobox is fed by the public catalog (HOS-919), fetched
// client-side. Mocked at the endpoint boundary so the suite owns the catalog.
vi.mock('@/lib/api/endpoints', () => ({
    hostTradeCategoryApi: { getHostTradeCatalog: mockGetHostTradeCatalog }
}));

const category = (slug: string, es: string, weight: number) => ({
    id: `00000000-0000-4000-8000-${String(weight).padStart(12, '0')}`,
    slug,
    nameI18n: { es, en: es, pt: es },
    displayWeight: weight,
    keywordsI18n: { es: [], en: [], pt: [] }
});

const TEST_CATALOG = {
    groups: [
        {
            slug: 'instalaciones',
            nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalações' },
            displayWeight: 10,
            categories: [category('plomeria', 'Plomería', 10), category('pintura', 'Pintura', 20)]
        }
    ]
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Opens the category combobox and picks each option by its visible name. */
async function pickCategories(names: ReadonlyArray<string>) {
    const input = await screen.findByLabelText(/^categorySlugs/i);
    for (const name of names) {
        fireEvent.click(input);
        fireEvent.mouseDown(await screen.findByRole('option', { name }));
    }
}

// Non-empty by default so `service_provider` tests can select a
// `destinationId` option without depending on the SSR-fetched real list.
const TEST_DESTINATIONS = [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Concepción del Uruguay' }
];

function renderForm(kind: 'partner' | 'sponsor' | 'service_provider' | 'editor' = 'partner') {
    return render(
        <AllianceLead
            locale="es"
            kind={kind}
            destinations={TEST_DESTINATIONS}
        />
    );
}

async function fillGenericRequiredFields(
    overrides: Partial<{ contactName: string; email: string }> = {}
) {
    const defaults = { contactName: 'Juan Pérez', email: 'juan@example.com' };
    const values = { ...defaults, ...overrides };

    fireEvent.change(screen.getByLabelText(/tu nombre/i), {
        target: { value: values.contactName }
    });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
        target: { value: values.email }
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AllianceLead', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
        mockGetHostTradeCatalog.mockReset();
        mockGetHostTradeCatalog.mockResolvedValue({ ok: true, data: TEST_CATALOG });
        // Reset call history too, not just the return value: several assertions
        // below check that /auth/me was NOT called, and a stale count from the
        // previous test would make them pass or fail for the wrong reason.
        mockReadCachedAuthMe.mockReset();
        mockFetchAuthMe.mockReset();
        // Default: anonymous visitor, the primary case for these forms.
        mockReadCachedAuthMe.mockReturnValue(null);
        mockFetchAuthMe.mockResolvedValue({
            isAuthenticated: false,
            user: null,
            permissions: [],
            roles: [],
            cachedAt: Date.now()
        });
        mockWriteCachedAuthMe.mockReset();
    });

    // ── Render — generic fields ─────────────────────────────────────────────

    it.each([
        'partner',
        'sponsor',
        'service_provider'
    ] as const)('uses the account email notice and flat accent submit for %s', async (kind) => {
        mockReadCachedAuthMe.mockReturnValue({
            isAuthenticated: true,
            user: { email: 'account@example.com', name: 'Applicant' }
        });
        renderForm(kind);
        expect(await screen.findByText('account@example.com')).toBeInTheDocument();
        expect(screen.queryByLabelText(/correo electrónico/i)).toBeNull();
        expect(screen.getByRole('button', { name: /enviar solicitud/i })).toHaveClass(
            'btn-gradient--accent',
            'btn-gradient--flat'
        );
    });

    it('associates sponsorship examples and a persistent hint with the native text field', () => {
        renderForm('sponsor');
        const input = screen.getByLabelText(/^sponsorshipInterest/i);
        expect(input).toHaveAttribute(
            'placeholder',
            'alliance-leads.form.placeholders.sponsorshipInterest'
        );
        expect(input).toHaveAccessibleDescription('alliance-leads.form.hints.sponsorshipInterest');
        fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
        expect(input).toHaveAttribute(
            'aria-describedby',
            'al-sponsorshipInterest-hint al-sponsorshipInterest-error'
        );
    });

    describe('Generic fields (all kinds)', () => {
        it('renders contactName input', () => {
            renderForm();
            expect(screen.getByLabelText(/tu nombre/i)).toBeInTheDocument();
        });

        it('renders email input', () => {
            renderForm();
            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });

        it('renders phone input (optional)', () => {
            renderForm();
            expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument();
        });

        it('renders the free-text message textarea (optional)', () => {
            renderForm();
            expect(screen.getByLabelText(/contanos más/i)).toBeInTheDocument();
        });

        it('renders submit button', () => {
            renderForm();
            expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeInTheDocument();
        });
    });

    // ── Render — kind-specific fields ───────────────────────────────────────

    describe('Kind-specific fields', () => {
        it('renders businessName, partnerType, website, partnershipType for partner (HOS-278 provisioning slice D)', () => {
            renderForm('partner');
            expect(screen.getByLabelText(/^businessName/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^partnerType/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^website/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^partnershipType/i)).toBeInTheDocument();
        });

        it('renders partnerType as a <select> element for partner', () => {
            renderForm('partner');
            expect(screen.getByLabelText(/^partnerType/i).tagName).toBe('SELECT');
        });

        it('renders businessName, website, sponsorshipInterest for sponsor', () => {
            renderForm('sponsor');
            expect(screen.getByLabelText(/^businessName/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^sponsorshipInterest/i)).toBeInTheDocument();
        });

        it('renders businessName, categorySlugs, destinationId, benefitType, website for service_provider (HOS-278 §6.4, HOS-919)', () => {
            renderForm('service_provider');
            expect(screen.getByLabelText(/^businessName/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^categorySlugs/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^destinationId/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^benefitType/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^website/i)).toBeInTheDocument();
        });

        it('renders categorySlugs as the grouped multi-select combobox, not a <select> (HOS-919)', () => {
            renderForm('service_provider');
            expect(screen.getByLabelText(/^categorySlugs/i)).toHaveAttribute('role', 'combobox');
        });

        it('renders destinationId, benefitType as <select> elements', () => {
            renderForm('service_provider');
            expect(screen.getByLabelText(/^destinationId/i).tagName).toBe('SELECT');
            expect(screen.getByLabelText(/^benefitType/i).tagName).toBe('SELECT');
        });

        it('does not render benefitValue until a numeric benefitType is selected', () => {
            renderForm('service_provider');
            expect(screen.queryByLabelText(/^benefitValue/i)).not.toBeInTheDocument();

            fireEvent.change(screen.getByLabelText(/^benefitType/i), {
                target: { value: 'PERCENTAGE' }
            });

            expect(screen.getByLabelText(/^benefitValue/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^benefitValue/i)).toHaveAttribute('type', 'number');
        });

        // HOS-652: the label carried no asterisk even though a numeric
        // benefitType makes the field mandatory — the seven other required
        // fields on this form all show one, so its absence here read as "this
        // field is optional" right up until submit rejected it.
        it('marks benefitValue as required (asterisk + required attribute) once a numeric benefitType is selected (HOS-652)', () => {
            renderForm('service_provider');

            fireEvent.change(screen.getByLabelText(/^benefitType/i), {
                target: { value: 'PERCENTAGE' }
            });

            const label = document.querySelector('label[for="al-benefitValue"]');
            expect(label?.textContent).toContain('*');
            expect(screen.getByLabelText(/^benefitValue/i)).toBeRequired();
        });

        it('does not render benefitValue for a non-numeric benefitType (e.g. TWO_FOR_ONE)', () => {
            renderForm('service_provider');
            fireEvent.change(screen.getByLabelText(/^benefitType/i), {
                target: { value: 'TWO_FOR_ONE' }
            });

            expect(screen.queryByLabelText(/^benefitValue/i)).not.toBeInTheDocument();
        });

        it('labels the free-text message as required for service_provider', () => {
            renderForm('service_provider');
            expect(screen.getByLabelText(/contanos sobre tu servicio/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/contanos sobre tu servicio/i)).toBeRequired();
        });

        it('renders portfolioLinks, topics, experience for editor — no businessName (B2C)', () => {
            renderForm('editor');
            expect(screen.getByLabelText(/^portfolioLinks/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^topics/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^experience/i)).toBeInTheDocument();
            expect(screen.queryByLabelText(/^businessName/i)).not.toBeInTheDocument();
        });

        it('marks the website field as type="url"', () => {
            renderForm('partner');
            expect(screen.getByLabelText(/^website/i)).toHaveAttribute('type', 'url');
        });
    });

    // ── Honeypot ─────────────────────────────────────────────────────────────

    describe('Honeypot field', () => {
        it('renders a hidden _hp field', () => {
            renderForm();
            const honeypot = document.querySelector('input[name="_hp"]');
            expect(honeypot).not.toBeNull();
        });

        it('_hp field has tabIndex=-1', () => {
            renderForm();
            const honeypot = document.querySelector('input[name="_hp"]');
            expect(honeypot).toHaveAttribute('tabindex', '-1');
        });
    });

    // ── Validation ────────────────────────────────────────────────────────────

    describe('Validation errors', () => {
        it('shows validation alerts and does not call fetch when submitted empty', async () => {
            renderForm('partner');
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('shows a required error on the kind-specific businessName field for partner', async () => {
            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/^businessName/i)).toHaveAttribute(
                    'aria-invalid',
                    'true'
                );
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('does not require businessName for editor', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('shows email error for invalid email', async () => {
            renderForm('editor');
            fireEvent.change(screen.getByLabelText(/tu nombre/i), {
                target: { value: 'Juan Pérez' }
            });
            fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
                target: { value: 'not-valid-email' }
            });
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
                    'aria-invalid',
                    'true'
                );
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('rejects a malformed website URL', async () => {
            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia' }
            });
            fireEvent.change(screen.getByLabelText(/^website/i), {
                target: { value: 'not-a-url' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/^website/i)).toHaveAttribute('aria-invalid', 'true');
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    // ── service_provider typed payload (HOS-278 §6.4) ───────────────────────

    describe('service_provider typed fields', () => {
        async function fillServiceProviderRequiredFields() {
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Plomería Acme' }
            });
            await pickCategories(['Plomería', 'Pintura']);
            fireEvent.change(screen.getByLabelText(/^destinationId/i), {
                target: { value: '11111111-1111-4111-8111-111111111111' }
            });
            fireEvent.change(screen.getByLabelText(/^benefitType/i), {
                target: { value: 'PERCENTAGE' }
            });
            fireEvent.change(screen.getByLabelText(/^benefitValue/i), {
                target: { value: '15' }
            });
            fireEvent.change(screen.getByLabelText(/contanos sobre tu servicio/i), {
                target: { value: 'Ofrecemos servicio 24hs para hosts.' }
            });
        }

        it('requires the free-text message (schema min(10) would otherwise reject an empty one)', async () => {
            renderForm('service_provider');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Plomería Acme' }
            });
            await pickCategories(['Plomería', 'Pintura']);
            fireEvent.change(screen.getByLabelText(/^destinationId/i), {
                target: { value: '11111111-1111-4111-8111-111111111111' }
            });
            fireEvent.change(screen.getByLabelText(/^benefitType/i), {
                target: { value: 'TWO_FOR_ONE' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/contanos sobre tu servicio/i)).toHaveAttribute(
                    'aria-invalid',
                    'true'
                );
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('requires categorySlugs, destinationId, benefitType', async () => {
            renderForm('service_provider');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Plomería Acme' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/^categorySlugs/i)).toHaveAttribute(
                    'aria-invalid',
                    'true'
                );
                expect(screen.getByLabelText(/^destinationId/i)).toHaveAttribute(
                    'aria-invalid',
                    'true'
                );
                expect(screen.getByLabelText(/^benefitType/i)).toHaveAttribute(
                    'aria-invalid',
                    'true'
                );
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('blocks submit with 0 categories and shows the required message on the field (AC-1.5)', async () => {
            renderForm('service_provider');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Plomería Acme' }
            });
            fireEvent.change(screen.getByLabelText(/^destinationId/i), {
                target: { value: '11111111-1111-4111-8111-111111111111' }
            });
            fireEvent.change(screen.getByLabelText(/^benefitType/i), {
                target: { value: 'TWO_FOR_ONE' }
            });
            fireEvent.change(screen.getByLabelText(/contanos sobre tu servicio/i), {
                target: { value: 'Ofrecemos servicio 24hs para hosts.' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(document.getElementById('al-categorySlugs-error')?.textContent).toBe(
                    'Este campo es obligatorio.'
                );
            });
            expect(document.activeElement?.id).toBe('al-categorySlugs');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('fetches the public catalog client-side for service_provider only', async () => {
            renderForm('service_provider');
            await screen.findByLabelText(/^categorySlugs/i);
            expect(mockGetHostTradeCatalog).toHaveBeenCalledTimes(1);
        });

        it('does not fetch the catalog for the other kinds', async () => {
            renderForm('partner');
            await screen.findByLabelText(/^businessName/i);
            expect(mockGetHostTradeCatalog).not.toHaveBeenCalled();
        });

        it('shows the chosen categories as chips', async () => {
            renderForm('service_provider');
            await pickCategories(['Plomería']);

            const chips = await screen.findByRole('list', { name: /rubros elegidos/i });
            expect(chips).toHaveTextContent('Plomería');
        });

        it('tells the applicant when the catalog could not be loaded', async () => {
            mockGetHostTradeCatalog.mockResolvedValue({
                ok: false,
                error: { status: 503, message: 'down' }
            });

            renderForm('service_provider');

            expect(await screen.findByRole('alert')).toHaveTextContent(
                /no pudimos cargar los rubros/i
            );
        });

        it('POSTs the typed fields as top-level payload keys, with benefitValue as a number', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('service_provider');
            await fillServiceProviderRequiredFields();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
            const callArgs = vi.mocked(global.fetch).mock.calls[0];
            const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                string,
                unknown
            >;

            expect(body.businessName).toBe('Plomería Acme');
            expect(body.categorySlugs).toEqual(['plomeria', 'pintura']);
            expect(body).not.toHaveProperty('category');
            expect(body.destinationId).toBe('11111111-1111-4111-8111-111111111111');
            expect(body.benefitType).toBe('PERCENTAGE');
            expect(body.benefitValue).toBe(15);
            expect(typeof body.benefitValue).toBe('number');
            expect(body.message).not.toContain('businessName');
            expect(body.message).toContain('Ofrecemos servicio 24hs para hosts.');
        });
    });

    // ── Submission ────────────────────────────────────────────────────────────

    // ── Signed-in applicant (HOS-278 AC-1) ──────────────────────────────────
    //
    // The visitor is resolved in the BROWSER, after hydration — these pages
    // must stay session-blind because `colaborar/editores` is edge-cached
    // (HOS-369 W2-2). So the suite drives `/auth/me`, not a prop.

    describe('Signed-in applicant', () => {
        function renderSignedIn(user: { name: string | null; email: string | null }) {
            mockReadCachedAuthMe.mockReturnValue({
                isAuthenticated: true,
                user: { id: 'u1', name: user.name ?? '', email: user.email ?? '' },
                permissions: [],
                roles: ['USER'],
                cachedAt: Date.now()
            });
            return render(
                <AllianceLead
                    locale="es"
                    kind="partner"
                />
            );
        }

        it('does NOT ask for the email when the account has one (AC-1)', async () => {
            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });

            await waitFor(() => {
                expect(screen.queryByLabelText(/correo electrónico/i)).not.toBeInTheDocument();
            });
        });

        it('states the address the application will be filed under', async () => {
            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });

            expect(await screen.findByText('juan@example.com')).toBeInTheDocument();
        });

        it('resolves the visitor without a network call when the shared cache is warm', async () => {
            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });

            await screen.findByText('juan@example.com');
            expect(mockFetchAuthMe).not.toHaveBeenCalled();
        });

        it('falls back to /auth/me when the shared cache is cold', async () => {
            mockReadCachedAuthMe.mockReturnValue(null);
            mockFetchAuthMe.mockResolvedValue({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Juan Pérez', email: 'juan@example.com' },
                permissions: [],
                roles: ['USER'],
                cachedAt: Date.now()
            });

            render(
                <AllianceLead
                    locale="es"
                    kind="partner"
                />
            );

            expect(await screen.findByText('juan@example.com')).toBeInTheDocument();
            expect(mockWriteCachedAuthMe).toHaveBeenCalled();
        });

        it('stays anonymous when /auth/me says guest', async () => {
            mockReadCachedAuthMe.mockReturnValue(null);
            mockFetchAuthMe.mockResolvedValue({
                isAuthenticated: false,
                user: null,
                permissions: [],
                roles: [],
                cachedAt: Date.now()
            });

            render(
                <AllianceLead
                    locale="es"
                    kind="partner"
                />
            );

            await waitFor(() => expect(mockFetchAuthMe).toHaveBeenCalled());
            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });

        it('pre-fills the contact name but leaves it editable', async () => {
            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });

            const nameInput = (await screen.findByLabelText(/tu nombre/i)) as HTMLInputElement;
            await waitFor(() => expect(nameInput.value).toBe('Juan Pérez'));
            expect(nameInput).not.toBeDisabled();
        });

        it('submits the account email even though no field collected it', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnerType/i), {
                target: { value: 'business' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
            const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
            expect(JSON.parse(String(init.body)).email).toBe('juan@example.com');
        });

        it('sends the session cookie, or the lead would arrive unlinked (AC-1)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnerType/i), {
                target: { value: 'business' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({ credentials: 'include' })
                );
            });
        });

        it('still asks for the email when the session carries none', () => {
            renderSignedIn({ name: 'Juan Pérez', email: null });

            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });

        it('still asks for the email when the session email is blank', () => {
            renderSignedIn({ name: 'Juan Pérez', email: '   ' });

            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });

        it('asks an anonymous visitor for the email as before (AC-2)', () => {
            renderForm('partner');

            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });
    });

    describe('Successful submission', () => {
        it('POSTs to /api/v1/public/alliance/leads', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnerType/i), {
                target: { value: 'business' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringMatching(/\/api\/v1\/public\/alliance\/leads$/),
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('sends kind: "partner" and serializes the non-typed specific fields into message (HOS-277 §7.3, HOS-278 provisioning slice D)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnerType/i), {
                target: { value: 'business' }
            });
            fireEvent.change(screen.getByLabelText(/^website/i), {
                target: { value: 'https://acme.com' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.kind).toBe('partner');
                // businessName is now a TYPED field for partner (HOS-278
                // provisioning slice D) — sent as its own key, not prose.
                expect(body.message).not.toContain('businessName');
                expect(body.message).toContain('website: https://acme.com');
                expect(body.message).toContain('partnershipType: Agencia de turismo');
            });
        });

        it('POSTs businessName and partnerType as top-level typed payload keys, keeping website/partnershipType in message (HOS-278 provisioning slice D)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/teléfono/i), {
                target: { value: '+5493444123456' }
            });
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnerType/i), {
                target: { value: 'business' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(Object.keys(body).sort()).toEqual(
                    [
                        '_hp',
                        'businessName',
                        'contactName',
                        'email',
                        'kind',
                        'message',
                        'partnerType',
                        'phone'
                    ].sort()
                );
                expect(body.businessName).toBe('Acme SA');
                expect(body.partnerType).toBe('business');
                // partnershipType stays prose — it is what alliance the
                // applicant is proposing, not a typed column.
                expect(body).not.toHaveProperty('partnershipType');
                expect(body.message).toContain('partnershipType: Agencia');
            });
        });

        it('replaces form with success message on 200', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByText(/gracias.*recibimos tu solicitud/i)).toBeInTheDocument();
            });
        });

        it('hides form fields after successful submission', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.queryByLabelText(/tu nombre/i)).not.toBeInTheDocument();
            });
        });
    });

    // ── Focus on first invalid field (HOS-652) ──────────────────────────────
    //
    // Before this, a failed submit set the `errors` state (so the inline
    // messages did render) and stopped — nothing moved the applicant's
    // attention to any of them. For someone who filled the form top-to-bottom
    // and submitted from the bottom, the error sat above their scroll
    // offset, so the observable effect was "nothing happens".

    describe('Focus first invalid field on failed submit (HOS-652)', () => {
        // jsdom does not implement `scrollIntoView`. Installed/removed
        // explicitly (not a plain assignment) so it can't leak across other
        // test files sharing this worker — see
        // `test/lib/forms/focus-first-invalid-field.test.ts` for the incident
        // this pattern was written to prevent.
        const hadNativeScrollIntoView = 'scrollIntoView' in Element.prototype;
        let scrollSpy: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            scrollSpy = vi.fn();
            Object.defineProperty(Element.prototype, 'scrollIntoView', {
                value: scrollSpy,
                configurable: true,
                writable: true
            });
        });

        afterEach(() => {
            if (hadNativeScrollIntoView) {
                Object.defineProperty(Element.prototype, 'scrollIntoView', {
                    value: undefined,
                    configurable: true,
                    writable: true
                });
            } else {
                delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
            }
        });

        it('moves focus to the first invalid field in DOM order, not the order errors were collected in', async () => {
            renderForm('service_provider');
            // `email` sits ABOVE the kind-specific fields on the page, but the
            // kind-specific validator runs first and inserts `businessName`
            // into the combined errors object before the schema validator
            // adds `email` — an implementation that focused by object-key
            // order instead of DOM order would land on `businessName`.
            fireEvent.change(screen.getByLabelText(/tu nombre/i), {
                target: { value: 'Juan Pérez' }
            });
            fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
                target: { value: 'not-an-email' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(document.activeElement?.id).toBe('al-email');
            });
        });

        it('scrolls the focused field into view', async () => {
            renderForm('partner');
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(scrollSpy).toHaveBeenCalled();
            });
        });

        it('focuses benefitValue when it is the only field blocking submission (HOS-652)', async () => {
            renderForm('service_provider');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Plomería Acme' }
            });
            await pickCategories(['Plomería', 'Pintura']);
            fireEvent.change(screen.getByLabelText(/^destinationId/i), {
                target: { value: '11111111-1111-4111-8111-111111111111' }
            });
            fireEvent.change(screen.getByLabelText(/^benefitType/i), {
                target: { value: 'PERCENTAGE' }
            });
            fireEvent.change(screen.getByLabelText(/contanos sobre tu servicio/i), {
                target: { value: 'Ofrecemos servicio 24hs para hosts.' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(document.activeElement?.id).toBe('al-benefitValue');
            });
        });
    });

    // ── Error handling ────────────────────────────────────────────────────────

    describe('API error handling', () => {
        it('shows rate-limit message on 429', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({})
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const rateLimitAlert = alerts.find((el) =>
                    el.textContent?.toLowerCase().includes('demasiados intentos')
                );
                expect(rateLimitAlert).toBeDefined();
            });
        });

        it('shows the API message on a 4xx non-ok response', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 409,
                json: async () => ({ error: { message: 'Server error' } })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const serverAlert = alerts.find((el) => el.textContent?.includes('Server error'));
                expect(serverAlert).toBeDefined();
            });
        });

        it('hides the API message and shows the localized error on a 5xx (HOS-2312)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: { message: 'Server error' } })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(
                    alerts.find((el) => el.textContent?.includes('Ocurrió un error'))
                ).toBeDefined();
            });
            expect(screen.queryByText('Server error')).toBeNull();
        });

        it('shows generic error when fetch throws', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });
    });
});
