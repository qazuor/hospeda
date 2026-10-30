// @vitest-environment jsdom
/**
 * Tests for `ListingPurgeOnRequestCard` (HOS-1493, action 23, AC:V8a:9).
 *
 * What would make the control silently wrong:
 *  - an admin without `LISTING_PURGE_ON_REQUEST` sees the button anyway;
 *  - the confirmation does not say which listing, that its content does not
 *    come back, or that the featured placement is cancelled;
 *  - the confirm button fires without a reason (or with only whitespace);
 *  - the mutation receives another vertical or id than the page's;
 *  - a 409 (the owner changed meanwhile) reads as a generic error.
 */

import esAdminEntities from '@repo/i18n/locales/es/admin-entities.json';
import { PermissionEnum, PublicationStatusEnum } from '@repo/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { ListingPurgeOnRequestCard } from '../ListingPurgeOnRequestCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * Resolves an `admin-entities.*` key against the REAL Spanish copy, so the
 * assertions below read what the admin reads (the global setup mock returns
 * bare keys, which would hide a missing name or a dropped sentence).
 */
function translateEs(key: string, params?: Readonly<Record<string, string>>): string {
    const path = key.replace(/^admin-entities\./, '').split('.');
    let node: unknown = esAdminEntities;
    for (const segment of path) {
        node =
            typeof node === 'object' && node !== null
                ? (node as Record<string, unknown>)[segment]
                : undefined;
    }
    if (typeof node !== 'string') return key;
    return Object.entries(params ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, value),
        node
    );
}

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translateEs, locale: 'es' })
}));

const permissions = vi.fn<() => PermissionEnum[]>(() => []);

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => permissions()
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ isLoading: false })
}));

const addToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast })
}));

const mutateAsync = vi.fn();
vi.mock('../../hooks/usePurgeListingOnRequestMutation', () => ({
    usePurgeListingOnRequestMutation: () => ({ mutateAsync, isPending: false })
}));

const LISTING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LISTING_NAME = 'Cabaña del Río Colón';

function renderCard(onPurged = vi.fn()) {
    render(
        React.createElement(ListingPurgeOnRequestCard, {
            vertical: 'venue',
            entityId: LISTING_ID,
            entityName: LISTING_NAME,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            onPurged
        })
    );
    return { onPurged };
}

async function openDialog() {
    const user = userEvent.setup();
    await user.click(screen.getByTestId('listing-purge-on-request'));
    const dialog = await screen.findByTestId('listing-purge-on-request-dialog');
    return { user, dialog };
}

beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({ purged: true });
    permissions.mockReturnValue([]);
});

describe('ListingPurgeOnRequestCard — gated by the action 23 permission', () => {
    it('TEST:1760:4 does not show purge for PURGED', () => {
        permissions.mockReturnValue([PermissionEnum.LISTING_PURGE_ON_REQUEST]);
        const CardWithState = ListingPurgeOnRequestCard as React.ComponentType<{
            vertical: 'venue';
            entityId: string;
            entityName: string;
            publicationStatus: PublicationStatusEnum;
            onPurged: () => void;
        }>;
        render(
            <CardWithState
                vertical="venue"
                entityId={LISTING_ID}
                entityName={LISTING_NAME}
                publicationStatus={PublicationStatusEnum.PURGED}
                onPurged={vi.fn()}
            />
        );
        expect(screen.queryByTestId('listing-purge-on-request')).not.toBeInTheDocument();
    });
    it('does not show purge while publication state is unknown', () => {
        permissions.mockReturnValue([PermissionEnum.LISTING_PURGE_ON_REQUEST]);
        const CardWithState = ListingPurgeOnRequestCard as React.ComponentType<{
            vertical: 'venue';
            entityId: string;
            entityName: string;
            publicationStatus?: PublicationStatusEnum;
            onPurged: () => void;
        }>;
        render(
            <CardWithState
                vertical="venue"
                entityId={LISTING_ID}
                entityName={LISTING_NAME}
                onPurged={vi.fn()}
            />
        );
        expect(screen.queryByTestId('listing-purge-on-request')).not.toBeInTheDocument();
    });
    it('renders nothing for an admin without LISTING_PURGE_ON_REQUEST', () => {
        // Arrange
        permissions.mockReturnValue([PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]);

        // Act
        renderCard();

        // Assert
        expect(screen.queryByTestId('listing-purge-on-request')).not.toBeInTheDocument();
    });
});

describe('ListingPurgeOnRequestCard — the confirmation says what happens (AC:V8a:9)', () => {
    beforeEach(() => {
        permissions.mockReturnValue([PermissionEnum.LISTING_PURGE_ON_REQUEST]);
    });

    it('names the listing, says its content does not come back and that the featured placement is cancelled', async () => {
        // Arrange
        renderCard();

        // Act
        const { dialog } = await openDialog();

        // Assert
        expect(dialog).toHaveTextContent(LISTING_NAME);
        expect(dialog).toHaveTextContent('se borra y no vuelve');
        expect(dialog).toHaveTextContent('se cancela');
        expect(dialog).toHaveTextContent('a pedido de su dueño');
        expect(dialog).not.toHaveTextContent('¿Estás seguro');
    });

    it('keeps confirm disabled without a reason and with only whitespace', async () => {
        // Arrange
        renderCard();
        const { user } = await openDialog();
        const confirm = screen.getByTestId('listing-purge-on-request-confirm');

        // Act + Assert: empty
        expect(confirm).toBeDisabled();

        // Act + Assert: whitespace only
        await user.type(screen.getByTestId('listing-purge-on-request-reason'), '    ');
        expect(confirm).toBeDisabled();
        await user.click(confirm);
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('with a reason, calls the mutation with { vertical, id, reason } and reports success', async () => {
        // Arrange
        const { onPurged } = renderCard();
        const { user } = await openDialog();

        // Act
        await user.type(
            screen.getByTestId('listing-purge-on-request-reason'),
            '  Juan lo pidió por correo  '
        );
        await user.click(screen.getByTestId('listing-purge-on-request-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith({
            vertical: 'venue',
            id: LISTING_ID,
            reason: 'Juan lo pidió por correo'
        });
        await waitFor(() => expect(onPurged).toHaveBeenCalledTimes(1));
        expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('shows a 409 as a changed state, not as a generic error, and does not navigate', async () => {
        // Arrange
        mutateAsync.mockRejectedValue(new ApiError('conflict', { status: 409 }));
        const { onPurged } = renderCard();
        const { user } = await openDialog();

        // Act
        await user.type(screen.getByTestId('listing-purge-on-request-reason'), 'pedido');
        await user.click(screen.getByTestId('listing-purge-on-request-confirm'));

        // Assert
        await waitFor(() => expect(addToast).toHaveBeenCalledTimes(1));
        expect(addToast).toHaveBeenCalledWith(
            expect.objectContaining({
                variant: 'warning',
                message: expect.stringContaining('cambió mientras tanto')
            })
        );
        expect(onPurged).not.toHaveBeenCalled();
    });

    it('shows any other failure as an error with its message', async () => {
        // Arrange
        mutateAsync.mockRejectedValue(new ApiError('Listing not found', { status: 404 }));
        renderCard();
        const { user } = await openDialog();

        // Act
        await user.type(screen.getByTestId('listing-purge-on-request-reason'), 'pedido');
        await user.click(screen.getByTestId('listing-purge-on-request-confirm'));

        // Assert
        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'error', message: 'Listing not found' })
            )
        );
    });
});
