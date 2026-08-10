/**
 * @file RegisterUsageForm.test.tsx
 * @description Tests for the QR-landing declaration form (HOS-376 T-045).
 *
 * The behaviours pinned here are the ones a refactor breaks silently:
 *
 *  - The date travels as the plain `YYYY-MM-DD` string the user picked. Any
 *    `Date` round-trip attaches a UTC midnight and shifts the day backwards for
 *    every UTC-3 caller, so "the 1st" is submitted as the 31st. A test that only
 *    checked "the API was called" would not notice.
 *  - An empty note is OMITTED, not sent as `''`. The column is nullable and the
 *    body schema is `.strict()`.
 *  - A refusal shows the DOMAIN's message (409, 403, 422 all carry their own
 *    copy) and does not render the success panel — recording nothing while
 *    saying "done" is the worst available outcome here.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDeclareUsage } = vi.hoisted(() => ({
    mockDeclareUsage: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        declareUsage: (...args: unknown[]) => mockDeclareUsage(...args)
    }
}));

import { RegisterUsageForm } from '../../../../src/components/host/host-trades/RegisterUsageForm.client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TODAY = '2026-08-10';
const PROVIDER_SLUG = 'fontanero-cdelu';
const PROVIDER_NAME = 'Fontanero CDU';

function renderForm() {
    return render(
        <RegisterUsageForm
            locale="es"
            providerSlug={PROVIDER_SLUG}
            providerName={PROVIDER_NAME}
            today={TODAY}
        />
    );
}

/** The submit button, which doubles as the busy indicator. */
function submitButton() {
    return screen.getByRole('button');
}

beforeEach(() => {
    mockDeclareUsage.mockReset();
    mockDeclareUsage.mockResolvedValue({
        ok: true,
        data: {
            usage: {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                status: 'PENDING',
                servicedAt: TODAY,
                expiresAt: '2026-09-09T00:00:00.000Z'
            }
        }
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RegisterUsageForm — initial state', () => {
    it('pre-fills the service date with today', () => {
        renderForm();

        const dateInput = screen.getByLabelText(/qué día fue el servicio/i);
        expect(dateInput).toHaveValue(TODAY);
    });

    it('caps the date picker at today, so a future day cannot be picked at all', () => {
        renderForm();

        expect(screen.getByLabelText(/qué día fue el servicio/i)).toHaveAttribute('max', TODAY);
    });

    it('names the provider in the pending-confirmation footnote', () => {
        renderForm();

        expect(screen.getByText(new RegExp(PROVIDER_NAME))).toBeInTheDocument();
    });

    it('shows no error and no success panel before anything is submitted', () => {
        renderForm();

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

describe('RegisterUsageForm — submitting', () => {
    it('sends the picked date as a plain YYYY-MM-DD string, with no note', async () => {
        const user = userEvent.setup();
        renderForm();

        await user.click(submitButton());

        await waitFor(() => expect(mockDeclareUsage).toHaveBeenCalledTimes(1));
        expect(mockDeclareUsage).toHaveBeenCalledWith({
            slug: PROVIDER_SLUG,
            servicedAt: TODAY,
            note: undefined
        });
    });

    it('sends an earlier date exactly as picked, without shifting the day', async () => {
        const user = userEvent.setup();
        renderForm();

        const dateInput = screen.getByLabelText(/qué día fue el servicio/i);
        await user.clear(dateInput);
        await user.type(dateInput, '2026-08-01');
        await user.click(submitButton());

        await waitFor(() => expect(mockDeclareUsage).toHaveBeenCalledTimes(1));
        expect(mockDeclareUsage.mock.calls[0][0].servicedAt).toBe('2026-08-01');
    });

    it('trims the note and sends it when the host wrote one', async () => {
        const user = userEvent.setup();
        renderForm();

        await user.type(screen.getByLabelText(/nota/i), '  cambio de cerradura  ');
        await user.click(submitButton());

        await waitFor(() => expect(mockDeclareUsage).toHaveBeenCalledTimes(1));
        expect(mockDeclareUsage.mock.calls[0][0].note).toBe('cambio de cerradura');
    });

    it('omits a whitespace-only note rather than sending an empty string', async () => {
        const user = userEvent.setup();
        renderForm();

        await user.type(screen.getByLabelText(/nota/i), '    ');
        await user.click(submitButton());

        await waitFor(() => expect(mockDeclareUsage).toHaveBeenCalledTimes(1));
        expect(mockDeclareUsage.mock.calls[0][0].note).toBeUndefined();
    });

    it('refuses a future service date locally, without spending a request', async () => {
        const user = userEvent.setup();
        renderForm();

        const dateInput = screen.getByLabelText(/qué día fue el servicio/i);
        await user.clear(dateInput);
        await user.type(dateInput, '2026-12-31');
        await user.click(submitButton());

        // Both halves matter: the refusal is VISIBLE and the request never left.
        expect(await screen.findByRole('alert')).toHaveTextContent(/no puede ser en el futuro/i);
        expect(mockDeclareUsage).not.toHaveBeenCalled();
    });
});

describe('RegisterUsageForm — outcomes', () => {
    it('confirms with the provider named, and links to the usages section', async () => {
        const user = userEvent.setup();
        renderForm();

        await user.click(submitButton());

        const panel = await screen.findByRole('status');
        expect(panel).toHaveTextContent(new RegExp(PROVIDER_NAME));

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', expect.stringContaining('usos-de-beneficio'));
    });

    it('replaces the form with the confirmation, so the usage cannot be sent twice', async () => {
        const user = userEvent.setup();
        renderForm();

        await user.click(submitButton());

        await screen.findByRole('status');
        expect(screen.queryByLabelText(/qué día fue el servicio/i)).not.toBeInTheDocument();
    });

    it('surfaces the domain refusal for an already-open pending usage', async () => {
        mockDeclareUsage.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'USAGE_PENDING_EXISTS',
                message: 'A pending usage already exists for this pair'
            }
        });
        const user = userEvent.setup();
        renderForm();

        await user.click(submitButton());

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/pendiente de confirmación/i);
        // The decisive half: nothing claims success.
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('surfaces the refusal for a suspended provider, which the read never reported', async () => {
        mockDeclareUsage.mockResolvedValue({
            ok: false,
            error: {
                status: 403,
                code: 'DECLARATION_SUSPENDED',
                message: 'Declaration is suspended for this provider'
            }
        });
        const user = userEvent.setup();
        renderForm();

        await user.click(submitButton());

        expect(await screen.findByRole('alert')).toHaveTextContent(/no puede registrar usos/i);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('keeps the form usable after a refusal, so the host can retry', async () => {
        mockDeclareUsage.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        const user = userEvent.setup();
        renderForm();

        await user.click(submitButton());

        await screen.findByRole('alert');
        expect(screen.getByLabelText(/qué día fue el servicio/i)).toBeInTheDocument();
        expect(submitButton()).not.toBeDisabled();
    });
});
