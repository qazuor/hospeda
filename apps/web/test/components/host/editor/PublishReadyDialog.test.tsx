/**
 * @file PublishReadyDialog.test.tsx
 * @description The post-save publish prompt's dialog (HOS-1183).
 *
 * The dialog is only ever opened once both halves of publishability hold, so
 * what these tests pin is that it never says more than it knows: the trial line
 * appears in exactly the branch where a trial starts, and a verdict that went
 * stale between the read and the click turns into the plans link rather than a
 * retry that fails identically.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishReadyDialog } from '@/components/host/editor/PublishReadyDialog.client';

const publishMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));

/** The trial line, asserted both present and absent. */
const TRIAL_NOTE = /prueba gratis de 30 días/i;

function props(overrides: Record<string, unknown> = {}) {
    return {
        isOpen: true,
        onClose: vi.fn(),
        locale: 'es' as const,
        accommodationId: 'acc-1',
        startsTrial: false,
        trialDays: 30,
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    publishMock.mockResolvedValue({ ok: true, data: {} });
});

describe('PublishReadyDialog', () => {
    it('renders nothing when closed', () => {
        render(<PublishReadyDialog {...props({ isOpen: false })} />);
        expect(screen.queryByText('Publicar ahora')).not.toBeInTheDocument();
    });

    it('offers publishing when the listing just became ready', () => {
        render(<PublishReadyDialog {...props()} />);

        expect(screen.getByText('Tu ficha ya está lista')).toBeInTheDocument();
        expect(screen.getByText('Publicar ahora')).toBeInTheDocument();
        expect(screen.getByText('Seguir editando')).toBeInTheDocument();
    });

    describe('the trial line', () => {
        it('appears when publishing would start a trial', () => {
            render(<PublishReadyDialog {...props({ startsTrial: true })} />);
            expect(screen.getByText(TRIAL_NOTE)).toBeInTheDocument();
        });

        it('is absent for an owner who is already paying', () => {
            // The absence half; its sibling above asserts the same matcher DOES
            // find the line, so a bad matcher cannot pass both.
            render(<PublishReadyDialog {...props({ startsTrial: false })} />);
            expect(screen.queryByText(TRIAL_NOTE)).not.toBeInTheDocument();
        });
    });

    it('publishes the accommodation it was given', async () => {
        const user = userEvent.setup();
        render(<PublishReadyDialog {...props({ accommodationId: 'acc-42' })} />);

        await user.click(screen.getByText('Publicar ahora'));

        await waitFor(() => expect(publishMock).toHaveBeenCalledWith({ id: 'acc-42' }));
    });

    it('turns into the plans link when the verdict went stale', async () => {
        // The verdict was read seconds earlier and a subscription can lapse in
        // between. Offering a retry here would fail identically.
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'FORBIDDEN', message: 'subscription_required' }
        });
        const user = userEvent.setup();
        render(<PublishReadyDialog {...props()} />);

        await user.click(screen.getByText('Publicar ahora'));

        await waitFor(() => {
            expect(screen.getByText('Ver planes')).toBeInTheDocument();
        });
        expect(screen.queryByText('Publicar ahora')).not.toBeInTheDocument();
    });

    it('promises no free days in the stale-verdict branch', async () => {
        // subscription_required means the trial is spent. A dialog that opened
        // announcing a trial and then kept the line while refusing would be the
        // worst of both.
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'FORBIDDEN', message: 'subscription_required' }
        });
        const user = userEvent.setup();
        render(<PublishReadyDialog {...props({ startsTrial: true })} />);

        await user.click(screen.getByText('Publicar ahora'));

        await waitFor(() => expect(screen.getByText('Ver planes')).toBeInTheDocument());
        expect(screen.queryByText(TRIAL_NOTE)).not.toBeInTheDocument();
    });

    it('offers a retry on an ordinary failure', async () => {
        // Not every failure is terminal. A network blip should not send the
        // owner to the plans page.
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR' }
        });
        const user = userEvent.setup();
        render(<PublishReadyDialog {...props()} />);

        await user.click(screen.getByText('Publicar ahora'));

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        expect(screen.getByText('Publicar ahora')).toBeInTheDocument();
        expect(screen.queryByText('Ver planes')).not.toBeInTheDocument();
    });
});
