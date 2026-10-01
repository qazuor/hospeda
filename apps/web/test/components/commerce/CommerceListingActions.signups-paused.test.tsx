/**
 * @file CommerceListingActions.signups-paused.test.tsx
 * @description Admin-paused new paid signups (`newPaidSignupsFrozen`) on the
 * owner commerce publish CTA.
 *
 * A publish that would START a subscription — a trial (`trial_available`) or
 * a checkout (`payment_required`) — shows the shared "paused" notice instead
 * of the button. A publish that ATTACHES the listing to the plan the owner
 * already pays for (`has_active_sub`) is exempt and keeps its button. And a
 * stale page flag that lets the click reach a frozen API shows the paused copy,
 * never the "already subscribed" copy a bare 409 used to get.
 */

import type { CommerceTrialVerdictKind } from '@repo/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingActions } from '../../../src/components/commerce/CommerceListingActions.client';

const { startOwnerListingCheckoutMock, PAUSED_BODY_COPY, PAUSED_API_COPY } = vi.hoisted(() => ({
    startOwnerListingCheckoutMock: vi.fn(),
    PAUSED_BODY_COPY: 'Contrataciones pausadas (notice copy).',
    PAUSED_API_COPY: 'Contrataciones pausadas (api error copy).'
}));

vi.mock('../../../src/lib/commerce/owner-listings', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/lib/commerce/owner-listings')>();
    return {
        ...actual,
        startOwnerListingCheckout: (...args: unknown[]) => startOwnerListingCheckoutMock(...args)
    };
});

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: () => ({ data: { user: { email: 'owner@local.test' } }, isPending: false })
}));

vi.mock('../../../src/lib/i18n', () => {
    const CATALOG: Record<string, string> = {
        'billing.checkout.signupsPaused.body': PAUSED_BODY_COPY,
        'common.apiError.NEW_PAID_SIGNUPS_FROZEN': PAUSED_API_COPY
    };
    return {
        createTranslations: (_locale: string) => ({
            t: (key: string, fallback?: string) => CATALOG[key] ?? fallback ?? key,
            tPlural: (key: string, count: number) => `${key} [${count}]`
        })
    };
});

vi.mock('../../../src/lib/billing/checkout-pending', () => ({
    storePendingCheckoutSubId: vi.fn()
}));

const COMPLETE_DRAFT = {
    id: '11111111-1111-4111-8111-111111111111',
    vertical: 'gastronomy' as const,
    slug: 'la-parrilla',
    name: 'La Parrilla',
    isPublic: false,
    subscriptionStatus: null,
    completeness: { complete: true, missing: [] as readonly string[] }
};

function renderActions({
    trialVerdict,
    newPaidSignupsFrozen
}: {
    trialVerdict: CommerceTrialVerdictKind;
    newPaidSignupsFrozen: boolean;
}) {
    render(
        <CommerceListingActions
            listing={COMPLETE_DRAFT as never}
            locale="es"
            trialVerdict={trialVerdict}
            newPaidSignupsFrozen={newPaidSignupsFrozen}
        />
    );
}

beforeEach(() => {
    Object.defineProperty(window, 'location', {
        value: { href: '', pathname: '/', reload: vi.fn() },
        writable: true,
        configurable: true
    });
    startOwnerListingCheckoutMock.mockReset();
});

describe('CommerceListingActions — admin-paused new paid signups', () => {
    it.each([
        'payment_required',
        'trial_available'
    ] as const)('shows the paused notice instead of the publish button (%s)', (trialVerdict) => {
        // Arrange / Act
        renderActions({ trialVerdict, newPaidSignupsFrozen: true });

        // Assert
        expect(screen.getByTestId('commerce-signups-paused-notice')).toHaveTextContent(
            PAUSED_BODY_COPY
        );
        expect(screen.queryByTestId('commerce-publish-button')).not.toBeInTheDocument();
    });

    it('keeps the publish button when the listing attaches to an existing plan (exempt)', () => {
        // Arrange / Act
        renderActions({ trialVerdict: 'has_active_sub', newPaidSignupsFrozen: true });

        // Assert
        expect(screen.getByTestId('commerce-publish-button')).toBeInTheDocument();
        expect(screen.queryByTestId('commerce-signups-paused-notice')).not.toBeInTheDocument();
    });

    it('shows the paused copy, not "already subscribed", when a stale flag reaches a frozen API', async () => {
        // Arrange
        startOwnerListingCheckoutMock.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'NEW_PAID_SIGNUPS_FROZEN',
                message: 'New subscriptions and purchases are temporarily paused.'
            }
        });
        const user = userEvent.setup();
        renderActions({ trialVerdict: 'payment_required', newPaidSignupsFrozen: false });

        // Act
        await user.click(screen.getByTestId('commerce-publish-button'));

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(PAUSED_API_COPY);
        });
        expect(screen.queryByText('Este comercio ya tiene una suscripción activa.')).toBeNull();
    });
});
