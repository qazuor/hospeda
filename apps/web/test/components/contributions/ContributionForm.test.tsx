/**
 * @file ContributionForm.test.tsx
 * @description Unit tests for the ContributionForm React island (SPEC-191 FR-3/4/5, D-3).
 *
 * Covers:
 * - Renders name/email/message fields + honeypot, NO type select (locked type)
 * - Submits the locked presetType in the POST payload
 * - Reads ?destino= client-side (report preset only): seeds the message and
 *   forwards the slug to the submit analytics event
 * - Fires the matching contribution_*_submitted event on 2xx only
 * - Shows the contribution-specific success copy
 * - Surfaces the friendly 429 rate-limit message (no event fired)
 * - Guard: ContactForm's CONTACT_TYPE_OPTIONS stays untouched (non-goal 7)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContributionType } from '../../../src/components/contributions/ContributionForm.client';
import { ContributionForm } from '../../../src/components/contributions/ContributionForm.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/ContactForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    const translations = { t } as const;
    return {
        createTranslations: () => translations
    };
});

const { trackEventMock } = vi.hoisted(() => ({ trackEventMock: vi.fn() }));

vi.mock('../../../src/lib/analytics/posthog-client', () => ({
    trackEvent: trackEventMock
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fillRequiredFields() {
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/Apellido/), { target: { value: 'López' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'ana@example.com' } });
    const message = screen.getByLabelText(/Mensaje|Contanos/);
    if ((message as HTMLTextAreaElement).value.length < 10) {
        fireEvent.change(message, {
            target: { value: 'Quiero aportar fotos del balneario y la costanera.' }
        });
    }
}

function mockFetch(status = 200) {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: status === 200 }), {
            status,
            headers: { 'Content-Type': 'application/json' }
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ContributionForm', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/es/colaborar/fotos/');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        trackEventMock.mockClear();
    });

    describe('locked type (D-3)', () => {
        it('renders the form fields without a type select', () => {
            render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                />
            );

            expect(screen.getByLabelText(/Nombre/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Apellido/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        });

        it('renders the honeypot website field', () => {
            const { container } = render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                />
            );

            expect(container.querySelector('input[name="website"]')).not.toBeNull();
        });

        it('POSTs the locked presetType in the payload', async () => {
            const fetchMock = mockFetch();
            render(
                <ContributionForm
                    presetType="editor_application"
                    locale="es"
                />
            );

            fillRequiredFields();
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
            const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
            expect(body.type).toBe('editor_application');
        });
    });

    describe('?destino= context (FR-3, report preset only)', () => {
        it('seeds the message with the destination slug and keeps it for analytics', async () => {
            window.history.replaceState({}, '', '/es/colaborar/reportar/?destino=colon');
            const fetchMock = mockFetch();

            render(
                <ContributionForm
                    presetType="report_destination_info"
                    locale="es"
                />
            );

            const message = (await screen.findByLabelText(
                /Mensaje|Contanos/
            )) as HTMLTextAreaElement;
            await waitFor(() => expect(message.value).toContain('colon'));

            fillRequiredFields();
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
            await waitFor(() =>
                expect(trackEventMock).toHaveBeenCalledWith('contribution_report_submitted', {
                    destino: 'colon',
                    locale: 'es'
                })
            );
        });

        it('works without a destino param (generic report, no destino in event props)', async () => {
            window.history.replaceState({}, '', '/es/colaborar/reportar/');
            const fetchMock = mockFetch();

            render(
                <ContributionForm
                    presetType="report_destination_info"
                    locale="es"
                />
            );

            fillRequiredFields();
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
            await waitFor(() =>
                expect(trackEventMock).toHaveBeenCalledWith('contribution_report_submitted', {
                    locale: 'es'
                })
            );
        });

        it('ignores ?destino= for non-report presets', () => {
            window.history.replaceState({}, '', '/es/colaborar/fotos/?destino=colon');

            render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                />
            );

            const message = screen.getByLabelText(/Mensaje|Contanos/) as HTMLTextAreaElement;
            expect(message.value).not.toContain('colon');
        });
    });

    describe('submit analytics (FR-9)', () => {
        it('fires contribution_photo_submitted with locale on 2xx', async () => {
            mockFetch();
            render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                />
            );

            fillRequiredFields();
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() =>
                expect(trackEventMock).toHaveBeenCalledWith('contribution_photo_submitted', {
                    locale: 'es'
                })
            );
        });

        it('does NOT fire any event on a failed submission', async () => {
            mockFetch(500);
            render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                />
            );

            fillRequiredFields();
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
            expect(trackEventMock).not.toHaveBeenCalled();
        });
    });

    describe('children slot (FR-4 terms note)', () => {
        it('renders children above the submit button', () => {
            render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                >
                    <p>Al enviar aceptás los términos de uso</p>
                </ContributionForm>
            );

            const note = screen.getByText(/Al enviar aceptás/);
            const submit = screen.getByRole('button');
            expect(note).toBeInTheDocument();
            // The note precedes the submit button in DOM order.
            expect(
                note.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
        });
    });

    describe('success and error states', () => {
        it('shows the contribution-specific success copy on 2xx', async () => {
            mockFetch();
            render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                />
            );

            fillRequiredFields();
            fireEvent.submit(screen.getByRole('form'));

            expect(await screen.findByText(/Gracias por tu aporte/)).toBeInTheDocument();
        });

        it('surfaces the friendly rate-limit message on 429', async () => {
            mockFetch(429);
            render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                />
            );

            fillRequiredFields();
            fireEvent.submit(screen.getByRole('form'));

            expect(await screen.findByText(/Demasiados intentos/)).toBeInTheDocument();
            expect(trackEventMock).not.toHaveBeenCalled();
        });

        it('surfaces a form-level error when validation fails on a non-rendered field (smoke regression)', async () => {
            // SPEC-191 T-015 smoke finding: with a stale @repo/schemas bundle,
            // the locked `type` was rejected by Zod — an error on a field this
            // form never renders — and the submit failed SILENTLY. The form
            // must surface the general error instead.
            const fetchMock = mockFetch();
            render(
                <ContributionForm
                    presetType={'not_a_valid_type' as ContributionType}
                    locale="es"
                />
            );

            fillRequiredFields();
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() =>
                expect(screen.getByText(/Ha ocurrido un error/)).toBeInTheDocument()
            );
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('shows field errors and does not POST when validation fails', async () => {
            const fetchMock = mockFetch();
            render(
                <ContributionForm
                    presetType="photo_submission"
                    locale="es"
                />
            );

            // Submit with empty fields — Zod must block the POST.
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });
});

describe('ContactForm guard (non-goal 7)', () => {
    it('CONTACT_TYPE_OPTIONS does not gain the contribution types', () => {
        const contactSrc = readFileSync(
            resolve(__dirname, '../../../src/components/ContactForm.client.tsx'),
            'utf8'
        );

        expect(contactSrc).not.toContain('report_destination_info');
        expect(contactSrc).not.toContain('photo_submission');
        expect(contactSrc).not.toContain('editor_application');
    });
});
