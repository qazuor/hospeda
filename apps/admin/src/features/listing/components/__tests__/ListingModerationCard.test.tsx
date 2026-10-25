// @vitest-environment jsdom
/**
 * Tests for `ListingModerationCard` (HOS-686 AC-26; moderation by action since
 * HOS-1684, AC-1684:1 and AC-1684:2).
 *
 * What would make the control silently wrong:
 *  - an admin without `LISTING_MODERATE` (even with a retired
 *    `*_MODERATION_CHANGE`) sees the buttons anyway;
 *  - a state shows a button the API can only refuse, or hides one it accepts;
 *  - the confirm fires without a reason (or with only whitespace);
 *  - the body carries a field another action owns, or loses one (a `LIFT`
 *    that always closes the fix request);
 *  - a refusal reads as a generic error, or the dialog stays open after it;
 *  - the card guesses the new state instead of showing the API's answer.
 */

import esAdminEntities from '@repo/i18n/locales/es/admin-entities.json';
import { PermissionEnum, PublicationStatusEnum } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import type { PurgeListingVertical } from '../../hooks/usePurgeListingOnRequestMutation';
import { ListingModerationCard } from '../ListingModerationCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * Resolves an `admin-entities.*` key against the REAL Spanish copy, so the
 * assertions read what the admin reads. Any other namespace (the badge's
 * `admin-filters.*`) comes back as its bare key.
 */
function translateEs(key: string, params?: Readonly<Record<string, string>>): string {
    if (!key.startsWith('admin-entities.')) return key;
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
vi.mock('../../hooks/useModerateListingMutation', () => ({
    useModerateListingMutation: () => ({ mutateAsync, isPending: false })
}));

const moderationRead = vi.hoisted(() => ({ data: undefined as unknown, error: false, calls: 0 }));
vi.mock('../../hooks/useListingModerationStateQuery', () => ({
    useListingModerationStateQuery: () => {
        moderationRead.calls += 1;
        return {
            data: moderationRead.data,
            isPending: moderationRead.data === undefined && !moderationRead.error,
            isError: moderationRead.error
        };
    }
}));

const es = esAdminEntities.listingModeration;
const LISTING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LISTING_NAME = 'Cabaña del Río Colón';
const openFixRequest = {
    reason: 'Arreglo',
    suggestedDate: null,
    openedAt: '2026-10-01T00:00:00.000Z',
    ownerReportedFixedAt: null
};

function renderCard({
    publicationStatus,
    vertical = 'gastronomy',
    fixRequest = null,
    queryError = false,
    statePublicationStatus
}: {
    readonly publicationStatus: PublicationStatusEnum | undefined;
    readonly vertical?: PurgeListingVertical;
    readonly fixRequest?: {
        reason: string;
        suggestedDate: string | null;
        openedAt: string;
        ownerReportedFixedAt: string | null;
    } | null;
    readonly queryError?: boolean;
    readonly statePublicationStatus?: PublicationStatusEnum;
}) {
    moderationRead.data = publicationStatus
        ? { publicationStatus: statePublicationStatus ?? publicationStatus, fixRequest }
        : undefined;
    moderationRead.error = queryError;
    return render(
        React.createElement(ListingModerationCard, {
            vertical,
            entityId: LISTING_ID,
            entityName: LISTING_NAME,
            publicationStatus
        })
    );
}

async function openAction(action: string) {
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`listing-moderation-action-${action}`));
    const dialog = await screen.findByTestId('listing-moderation-dialog');
    return { user, dialog };
}

const actionButtons = () =>
    screen
        .queryAllByTestId(/^listing-moderation-action-/)
        .map((node) => node.getAttribute('data-testid'));

beforeEach(() => {
    vi.clearAllMocks();
    moderationRead.calls = 0;
    mutateAsync.mockResolvedValue({ publicationStatus: 'MODERATED', fixRequestOpen: false });
    permissions.mockReturnValue([PermissionEnum.LISTING_MODERATE]);
});

describe('ListingModerationCard — the publication state badge', () => {
    it.each(Object.values(PublicationStatusEnum))('shows %s with its own label', (status) => {
        // Arrange / Act
        renderCard({ publicationStatus: status });

        // Assert
        const card = screen.getByTestId('listing-moderation');
        expect(card.textContent).toContain(
            `admin-filters.publicationStatus.${
                {
                    DRAFT: 'draft',
                    PUBLISHED: 'published',
                    UNPUBLISHED_BY_BILLING: 'unpublishedByBilling',
                    ARCHIVED: 'archived',
                    MODERATED: 'moderated',
                    PURGED: 'purged'
                }[status]
            }`
        );
    });

    it('renders no badge and no button while the state is not loaded yet', () => {
        // Arrange / Act
        renderCard({ publicationStatus: undefined });

        // Assert
        expect(screen.getByTestId('listing-moderation').textContent).not.toContain(
            'admin-filters.publicationStatus'
        );
        expect(actionButtons()).toEqual([]);
    });
});

describe('TEST:1684:2 AC-1684:1 buttons by state and by permission', () => {
    it('TEST:1760:3 derives actions from the GET state instead of the listing prop', () => {
        renderCard({
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            statePublicationStatus: PublicationStatusEnum.MODERATED
        });
        expect(actionButtons()).toEqual([
            'listing-moderation-action-LIFT',
            'listing-moderation-action-REQUEST_FIX'
        ]);
    });
    it('TEST:1760:3 shows an error and no actions when the state GET fails', () => {
        renderCard({ publicationStatus: PublicationStatusEnum.PUBLISHED, queryError: true });
        expect(actionButtons()).toEqual([]);
        expect(screen.getByRole('alert').textContent).toContain(es.stateError);
    });
    it('shows no button to an admin without LISTING_MODERATE, even with the retired permission', () => {
        // Arrange
        permissions.mockReturnValue([PermissionEnum.ACCOMMODATION_MODERATION_CHANGE]);

        // Act
        renderCard({ publicationStatus: PublicationStatusEnum.PUBLISHED });

        // Assert
        expect(actionButtons()).toEqual([]);
        expect(screen.getByTestId('listing-moderation')).toBeInTheDocument();
        expect(moderationRead.calls).toBe(0);
    });

    it.each([
        [
            PublicationStatusEnum.PUBLISHED,
            ['REQUEST_FIX', 'TAKE_DOWN'],
            [es.actions.requestFix, es.actions.takeDown]
        ],
        [
            PublicationStatusEnum.MODERATED,
            ['LIFT', 'REQUEST_FIX'],
            [es.actions.lift, es.actions.requestFix]
        ],
        [PublicationStatusEnum.PURGED, [], []]
    ] as const)('%s shows exactly %j', (publicationStatus, expected, labels) => {
        // Arrange / Act
        renderCard({ publicationStatus });

        // Assert
        expect(actionButtons()).toEqual(expected.map((a) => `listing-moderation-action-${a}`));
        expect(
            screen.queryAllByTestId(/^listing-moderation-action-/).map((n) => n.textContent)
        ).toEqual(labels);
    });

    it('TEST:1760:3 shows only close and take down for an open request and renders its details', () => {
        renderCard({
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            fixRequest: {
                reason: 'Fix the photos',
                suggestedDate: '2026-11-01',
                openedAt: '2026-10-01T00:00:00.000Z',
                ownerReportedFixedAt: null
            }
        });
        expect(actionButtons()).toEqual([
            'listing-moderation-action-TAKE_DOWN',
            'listing-moderation-action-CLOSE_FIX_REQUEST'
        ]);
        expect(screen.getByTestId('listing-moderation').textContent).toContain('Fix the photos');
        expect(
            screen.queryByTestId('listing-moderation-action-REQUEST_FIX')
        ).not.toBeInTheDocument();
    });

    it('TAKE_DOWN says what happens and keeps confirm disabled without a real reason', async () => {
        // Arrange
        renderCard({ publicationStatus: PublicationStatusEnum.PUBLISHED });
        const { user, dialog } = await openAction('TAKE_DOWN');
        const confirm = screen.getByTestId('listing-moderation-confirm');

        // Assert: the four lines of H10, with the listing's name
        expect(dialog).toHaveTextContent(LISTING_NAME);
        expect(dialog).toHaveTextContent(es.dialog.takeDown.ownerNotice);
        expect(dialog).toHaveTextContent(es.dialog.takeDown.featured);
        expect(confirm).toBeDisabled();

        // Act + Assert: whitespace only
        await user.type(screen.getByTestId('listing-moderation-reason'), '    ');
        expect(confirm).toBeDisabled();
        await user.click(confirm);
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('TAKE_DOWN sends exactly { action, reason } with the trimmed reason', async () => {
        // Arrange
        renderCard({ publicationStatus: PublicationStatusEnum.PUBLISHED });
        const { user } = await openAction('TAKE_DOWN');

        // Act
        await user.type(screen.getByTestId('listing-moderation-reason'), '  Fotos falsas  ');
        await user.click(screen.getByTestId('listing-moderation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
            vertical: 'gastronomy',
            id: LISTING_ID,
            body: { action: 'TAKE_DOWN', reason: 'Fotos falsas' }
        });
    });

    it('LIFT sends keepFixRequest: false by default', async () => {
        // Arrange
        renderCard({ publicationStatus: PublicationStatusEnum.MODERATED });
        const { user } = await openAction('LIFT');

        // Act
        await user.type(screen.getByTestId('listing-moderation-reason'), 'Corregida');
        await user.click(screen.getByTestId('listing-moderation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
            vertical: 'gastronomy',
            id: LISTING_ID,
            body: { action: 'LIFT', reason: 'Corregida', keepFixRequest: false }
        });
    });

    it('LIFT sends keepFixRequest: true with the switch on', async () => {
        // Arrange
        renderCard({ publicationStatus: PublicationStatusEnum.MODERATED });
        const { user } = await openAction('LIFT');

        // Act
        await user.click(screen.getByTestId('listing-moderation-keep-fix-request'));
        await user.type(screen.getByTestId('listing-moderation-reason'), 'Falta un detalle');
        await user.click(screen.getByTestId('listing-moderation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
            vertical: 'gastronomy',
            id: LISTING_ID,
            body: { action: 'LIFT', reason: 'Falta un detalle', keepFixRequest: true }
        });
    });

    it('REQUEST_FIX sends suggestedDate: null without a date', async () => {
        // Arrange
        renderCard({ publicationStatus: PublicationStatusEnum.DRAFT });
        const { user } = await openAction('REQUEST_FIX');

        // Act
        await user.type(screen.getByTestId('listing-moderation-reason'), 'Cambiar fotos');
        await user.click(screen.getByTestId('listing-moderation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
            vertical: 'gastronomy',
            id: LISTING_ID,
            body: { action: 'REQUEST_FIX', reason: 'Cambiar fotos', suggestedDate: null }
        });
    });

    it('REQUEST_FIX sends the suggested date when one is set', async () => {
        // Arrange
        renderCard({ publicationStatus: PublicationStatusEnum.ARCHIVED });
        const { user } = await openAction('REQUEST_FIX');

        // Act
        fireEvent.change(screen.getByTestId('listing-moderation-suggested-date'), {
            target: { value: '2026-11-01' }
        });
        await user.type(screen.getByTestId('listing-moderation-reason'), 'Cambiar fotos');
        await user.click(screen.getByTestId('listing-moderation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
            vertical: 'gastronomy',
            id: LISTING_ID,
            body: { action: 'REQUEST_FIX', reason: 'Cambiar fotos', suggestedDate: '2026-11-01' }
        });
    });

    it('CLOSE_FIX_REQUEST sends only action and reason, and offers no extra field', async () => {
        // Arrange
        renderCard({
            publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            fixRequest: openFixRequest
        });
        const { user } = await openAction('CLOSE_FIX_REQUEST');

        // Assert: neither the date nor the switch belong to this action
        expect(screen.queryByTestId('listing-moderation-suggested-date')).toBeNull();
        expect(screen.queryByTestId('listing-moderation-keep-fix-request')).toBeNull();

        // Act
        await user.type(screen.getByTestId('listing-moderation-reason'), 'Ya está');
        await user.click(screen.getByTestId('listing-moderation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
            vertical: 'gastronomy',
            id: LISTING_ID,
            body: { action: 'CLOSE_FIX_REQUEST', reason: 'Ya está' }
        });
    });

    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('%s reaches the hook with its own vertical', async (vertical) => {
        // Arrange
        renderCard({ publicationStatus: PublicationStatusEnum.PUBLISHED, vertical });
        const { user } = await openAction('TAKE_DOWN');

        // Act
        await user.type(screen.getByTestId('listing-moderation-reason'), 'motivo');
        await user.click(screen.getByTestId('listing-moderation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
            vertical,
            id: LISTING_ID,
            body: { action: 'TAKE_DOWN', reason: 'motivo' }
        });
    });
});

describe('TEST:1684:4 AC-1684:2 the API answer and its typed rejections', () => {
    async function confirm(action: string) {
        const { user } = await openAction(action);
        await user.type(screen.getByTestId('listing-moderation-reason'), 'motivo');
        await user.click(screen.getByTestId('listing-moderation-confirm'));
    }

    it.each([
        [true, es.fixRequestOpen],
        [false, es.fixRequestClosed]
    ])('on success shows the returned state (fixRequestOpen %s) and closes the dialog', async (fixRequestOpen, fixText) => {
        // Arrange
        mutateAsync.mockResolvedValue({ publicationStatus: 'MODERATED', fixRequestOpen });
        renderCard({ publicationStatus: PublicationStatusEnum.PUBLISHED });

        // Act
        await confirm('TAKE_DOWN');

        // Assert
        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith({
                title: es.successTitle,
                message: 'La ficha quedó en: admin-filters.publicationStatus.moderated.',
                variant: 'success'
            })
        );
        const result = screen.getByTestId('listing-moderation-result');
        expect(result).toHaveTextContent('admin-filters.publicationStatus.moderated');
        expect(result).toHaveTextContent(fixText);
        await waitFor(() => expect(screen.queryByTestId('listing-moderation-dialog')).toBeNull());
    });

    it.each([
        ['LIFT', PublicationStatusEnum.MODERATED, 409, es.errors.conflict.lift, 'warning'],
        ['TAKE_DOWN', PublicationStatusEnum.PUBLISHED, 409, es.errors.conflict.takeDown, 'warning'],
        ['TAKE_DOWN', PublicationStatusEnum.PUBLISHED, 403, es.errors.forbidden, 'error'],
        ['REQUEST_FIX', PublicationStatusEnum.PUBLISHED, 404, es.errors.notFound, 'error'],
        ['CLOSE_FIX_REQUEST', PublicationStatusEnum.DRAFT, 400, es.errors.invalid, 'error']
    ] as const)('%s on %s answered %i reads as its own text and closes the dialog', async (action, publicationStatus, status, message, variant) => {
        // Arrange
        mutateAsync.mockRejectedValue(new ApiError('Listing state changed', { status }));
        renderCard({
            publicationStatus,
            ...(action === 'CLOSE_FIX_REQUEST'
                ? {
                      fixRequest: openFixRequest
                  }
                : {})
        });

        // Act
        await confirm(action);

        // Assert
        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith({
                title: es.errors.title,
                message,
                variant
            })
        );
        expect(screen.queryByTestId('listing-moderation-result')).toBeNull();
        await waitFor(() => expect(screen.queryByTestId('listing-moderation-dialog')).toBeNull());
    });

    it('shows any other failure as an error with its message', async () => {
        // Arrange
        mutateAsync.mockRejectedValue(new Error('network down'));
        renderCard({ publicationStatus: PublicationStatusEnum.PUBLISHED });

        // Act
        await confirm('TAKE_DOWN');

        // Assert
        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith({
                title: es.errors.title,
                message: 'network down',
                variant: 'error'
            })
        );
    });
});
