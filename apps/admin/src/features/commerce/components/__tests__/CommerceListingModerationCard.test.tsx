// @vitest-environment jsdom
/**
 * Tests for `CommerceListingModerationCard` (HOS-686, AC-26).
 *
 * "A route with no control is reachable only by a hand-crafted request", so the
 * things worth asserting are the ones that would silently make the button do
 * nothing useful:
 *
 *  - it renders REJECTED as an option at all;
 *  - choosing it goes through the confirmation dialog and then calls the
 *    mutation with `{ moderationState: 'REJECTED' }`;
 *  - an admin without `COMMERCE_MODERATION_CHANGE` gets the read-only badge and
 *    cannot fire the mutation.
 *
 * The permission case is the one that fails invisibly in a browser: a
 * mis-declared permission renders a badge that looks like an ordinary read-only
 * cell, which is exactly what a correctly-denied user also sees.
 */

import { ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingModerationCard } from '../CommerceListingModerationCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const permissions = vi.fn<() => PermissionEnum[]>(() => []);

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => permissions()
}));

const addToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast })
}));

const mutateAsync = vi.fn().mockResolvedValue({});
const useModerateMutation = vi.fn(() => ({ mutateAsync, isPending: false }));

const LISTING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function renderCard() {
    return render(
        React.createElement(CommerceListingModerationCard, {
            entityId: LISTING_ID,
            entityName: 'Bar del Puerto',
            entityLabelKey: 'admin-entities.entities.gastronomy.singular',
            currentValue: ModerationStatusEnum.APPROVED,
            useModerateMutation
        })
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({});
    permissions.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// With the permission
// ---------------------------------------------------------------------------

describe('CommerceListingModerationCard — an authorised admin can reject (AC-26)', () => {
    beforeEach(() => {
        permissions.mockReturnValue([PermissionEnum.COMMERCE_MODERATION_CHANGE]);
    });

    it('renders an interactive trigger showing the current state', () => {
        renderCard();
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('passes the listing id to the vertical mutation hook', () => {
        renderCard();
        expect(useModerateMutation).toHaveBeenCalledWith(LISTING_ID);
    });

    it('rejecting asks for confirmation, then calls the mutation with REJECTED', async () => {
        const user = userEvent.setup();
        renderCard();

        await user.click(screen.getByRole('button'));

        // Labels resolve to their i18n KEYS here: no locale bundle is loaded in
        // the unit environment, and `t` echoes the key. Matching on the key is
        // the stable choice — matching on Spanish copy would make this suite
        // break on a wording change and pass on a wrong-key change.
        const rejectOption = await screen.findByRole('menuitem', {
            name: 'admin-entities.states.moderation.rejected'
        });
        await user.click(rejectOption);

        // The confirmation is not decoration: this is what takes a paying
        // listing off the public site.
        expect(mutateAsync).not.toHaveBeenCalled();

        const confirmButton = await screen.findByRole('button', {
            name: 'admin-entities.confirmations.reject.confirm'
        });
        await user.click(confirmButton);

        await waitFor(() =>
            expect(mutateAsync).toHaveBeenCalledWith({
                moderationState: ModerationStatusEnum.REJECTED
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Without the permission
// ---------------------------------------------------------------------------

describe('CommerceListingModerationCard — an unauthorised admin cannot (AC-26)', () => {
    it('renders read-only when the actor lacks COMMERCE_MODERATION_CHANGE', () => {
        // Holding every OTHER commerce permission, including the review one, is
        // still not enough — the panel mirrors the server-side gate.
        permissions.mockReturnValue([
            PermissionEnum.COMMERCE_EDIT_ALL,
            PermissionEnum.COMMERCE_VIEW_ALL,
            PermissionEnum.COMMERCE_MODERATE_REVIEW
        ]);

        renderCard();

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(mutateAsync).not.toHaveBeenCalled();
    });
});
