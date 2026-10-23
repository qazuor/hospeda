/**
 * @file AllianceLead.message-error.test.tsx
 * @description RTL tests for the optional free-text `message` error of the
 * AllianceLead island (HOS-1767 AC:1767:1, AC:1767:2, AC:1767:3).
 *
 * The server schema validates `message` with `.min(10)`, but the form
 * serializes the structured fields into that same string. With the required
 * fields filled the minimum is satisfied by their labels; the schema error
 * only appears with everything empty, and it must not be blamed on the
 * optional free-text box.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: mockReadCachedAuthMe,
    fetchAuthMe: mockFetchAuthMe,
    writeCachedAuthMe: mockWriteCachedAuthMe
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_DESTINATIONS = [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Concepción del Uruguay' }
];

const OPTIONAL_KINDS = ['partner', 'sponsor', 'editor'] as const;

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

function fillPartnerRequiredFields(): void {
    fireEvent.change(screen.getByLabelText(/^businessName/i), {
        target: { value: 'Acme SA' }
    });
    fireEvent.change(screen.getByLabelText(/^partnerType/i), {
        target: { value: 'business' }
    });
    fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
        target: { value: 'Agencia de turismo' }
    });
}

function fillSponsorRequiredFields(): void {
    fireEvent.change(screen.getByLabelText(/^businessName/i), {
        target: { value: 'Acme SA' }
    });
    fireEvent.change(screen.getByLabelText(/^sponsorshipInterest/i), {
        target: { value: 'Eventos de la región' }
    });
}

function fillEditorRequiredFields(): void {
    fireEvent.change(screen.getByLabelText(/^topics/i), {
        target: { value: 'Gastronomía regional' }
    });
}

const SPECIFIC_REQUIRED_LABELS: Record<(typeof OPTIONAL_KINDS)[number], readonly RegExp[]> = {
    partner: [/^businessName/i, /^partnerType/i, /^partnershipType/i],
    sponsor: [/^businessName/i, /^sponsorshipInterest/i],
    editor: [/^topics/i]
};

function submitForm(): void {
    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AllianceLead optional message error', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
        mockReadCachedAuthMe.mockReset();
        mockFetchAuthMe.mockReset();
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

    it.each(
        OPTIONAL_KINDS
    )('AC:1767:1 — shows no error on the optional message for %s when everything is empty', async (kind) => {
        renderForm(kind);
        submitForm();

        await waitFor(() => {
            expect(screen.getByLabelText(/tu nombre/i)).toHaveAttribute('aria-invalid', 'true');
        });

        for (const label of SPECIFIC_REQUIRED_LABELS[kind]) {
            expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
        }

        const message = screen.getByLabelText(/contanos más \(opcional\)/i);
        expect(message).toHaveAttribute('id', 'al-message');
        expect(message).toHaveAttribute('aria-invalid', 'false');
        expect(document.getElementById('al-message-error')).toBeNull();
        expect(document.activeElement).toBe(screen.getByLabelText(/tu nombre/i));
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('AC:1767:2 — keeps the message error for service_provider', async () => {
        renderForm('service_provider');
        await fillGenericRequiredFields();
        submitForm();

        await waitFor(() => {
            expect(screen.getByLabelText(/contanos sobre tu servicio/i)).toHaveAttribute(
                'aria-invalid',
                'true'
            );
        });

        expect(screen.getByText('Contanos brevemente sobre tu servicio.')).toBeInTheDocument();
        expect(document.getElementById('al-message-error')).not.toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it.each(
        OPTIONAL_KINDS
    )('AC:1767:3 — submits %s with an empty free text once the required fields are filled', async (kind) => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

        renderForm(kind);
        await fillGenericRequiredFields();
        if (kind === 'partner') fillPartnerRequiredFields();
        if (kind === 'sponsor') fillSponsorRequiredFields();
        if (kind === 'editor') fillEditorRequiredFields();
        submitForm();

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringMatching(/\/api\/v1\/public\/alliance\/leads$/),
                expect.objectContaining({ method: 'POST' })
            );
        });

        const callArgs = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as {
            kind: string;
            message: string;
        };
        expect(body.kind).toBe(kind);
        expect(body.message.length).toBeGreaterThanOrEqual(10);
    });
});
