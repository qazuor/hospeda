// @vitest-environment jsdom
/**
 * Tests for `AccountCloseOnRequestCard` (HOS-1494, action 24, AC:V8a:11).
 *
 * What would make the control silently wrong:
 *  - an admin without `USER_CLOSE_ON_REQUEST` (even holding `USER_DELETE`)
 *    sees the button anyway;
 *  - a blocked account offers a confirm button, or does not say what blocks it;
 *  - the confirmation does not say whose account it is or that nothing is left
 *    to charge and no listing remains;
 *  - the confirm button fires without a reason (or with only whitespace);
 *  - a 409 (the account changed meanwhile) reads as a generic error, or does not
 *    read the preview again.
 */

import esAdminEntities from '@repo/i18n/locales/es/admin-entities.json';
import { type AccountClosurePreview, PermissionEnum } from '@repo/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { AccountCloseOnRequestCard } from '../AccountCloseOnRequestCard';

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

const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const READY: AccountClosurePreview = {
    userId: USER_ID,
    displayName: 'Juan Pérez',
    email: 'juan.perez@example.com',
    canCharge: false,
    listingsNotPurged: 0,
    partnerPresenceWithContent: false,
    ready: true
};

interface PreviewState {
    isLoading: boolean;
    error: unknown;
    data: AccountClosurePreview | undefined;
}

const previewState: PreviewState = { isLoading: false, error: null, data: READY };
const refetch = vi.fn();
const previewInputs = vi.fn();
const mutateAsync = vi.fn();

vi.mock('../../hooks/useAccountClosure', () => ({
    useAccountClosurePreview: (input: { userId: string; enabled: boolean }) => {
        previewInputs(input);
        return { ...previewState, refetch };
    },
    useCloseAccountOnRequestMutation: () => ({ mutateAsync, isPending: false })
}));

function renderCard(onClosed = vi.fn()) {
    render(React.createElement(AccountCloseOnRequestCard, { userId: USER_ID, onClosed }));
    return { onClosed };
}

async function openDialog() {
    const user = userEvent.setup();
    await user.click(screen.getByTestId('account-close-on-request'));
    const dialog = await screen.findByTestId('account-close-on-request-dialog');
    return { user, dialog };
}

beforeEach(() => {
    vi.clearAllMocks();
    previewState.isLoading = false;
    previewState.error = null;
    previewState.data = READY;
    mutateAsync.mockResolvedValue({ closed: true });
    refetch.mockResolvedValue({});
    permissions.mockReturnValue([PermissionEnum.USER_CLOSE_ON_REQUEST]);
});

describe('TEST:V8a:11 action 24 confirmation (unit)', () => {
    it('renders nothing for an admin with USER_DELETE but without USER_CLOSE_ON_REQUEST', () => {
        // Arrange
        permissions.mockReturnValue([PermissionEnum.USER_DELETE, PermissionEnum.USER_HARD_DELETE]);

        // Act
        renderCard();

        // Assert
        expect(screen.queryByTestId('account-close-on-request')).not.toBeInTheDocument();
    });

    it('reads the preview only once the dialog is open', async () => {
        // Arrange
        renderCard();

        // Assert: closed
        expect(previewInputs).toHaveBeenLastCalledWith({ userId: USER_ID, enabled: false });

        // Act
        await openDialog();

        // Assert: open
        expect(previewInputs).toHaveBeenLastCalledWith({ userId: USER_ID, enabled: true });
    });

    it('ready = false: says what blocks it, one line per precondition, and has no confirm button', async () => {
        // Arrange
        previewState.data = {
            ...READY,
            canCharge: true,
            listingsNotPurged: 2,
            partnerPresenceWithContent: true,
            ready: false
        };
        renderCard();

        // Act
        const { dialog } = await openDialog();

        // Assert
        expect(screen.getByTestId('account-close-on-request-blocked-charge')).toHaveTextContent(
            'cancelala primero'
        );
        expect(screen.getByTestId('account-close-on-request-blocked-listings')).toHaveTextContent(
            'fichas sin borrar (2)'
        );
        expect(screen.getByTestId('account-close-on-request-blocked-partner')).toHaveTextContent(
            'vaciarla primero'
        );
        expect(screen.queryByTestId('account-close-on-request-confirm')).not.toBeInTheDocument();
        expect(screen.queryByTestId('account-close-on-request-reason')).not.toBeInTheDocument();
        expect(dialog).not.toHaveTextContent('No le queda cobro');
    });

    it('ready = false with only listings left shows only that line', async () => {
        // Arrange
        previewState.data = { ...READY, listingsNotPurged: 1, ready: false };
        renderCard();

        // Act
        await openDialog();

        // Assert
        expect(screen.getByTestId('account-close-on-request-blocked-listings')).toBeInTheDocument();
        expect(
            screen.queryByTestId('account-close-on-request-blocked-charge')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('account-close-on-request-blocked-partner')
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId('account-close-on-request-confirm')).not.toBeInTheDocument();
    });

    it('ready = true: says whose account it is and that nothing is left to charge or list', async () => {
        // Arrange
        renderCard();

        // Act
        const { dialog } = await openDialog();

        // Assert
        expect(dialog).toHaveTextContent('Juan Pérez');
        expect(dialog).toHaveTextContent('juan.perez@example.com');
        expect(dialog).toHaveTextContent('No le queda cobro, ficha ni presencia de Partner');
        expect(dialog).toHaveTextContent('se seudonimiza');
        expect(dialog).toHaveTextContent('a pedido de su dueño');
        expect(dialog).not.toHaveTextContent('¿Estás seguro');
    });

    it('keeps confirm disabled without a reason and with only whitespace', async () => {
        // Arrange
        renderCard();
        const { user } = await openDialog();
        const confirm = screen.getByTestId('account-close-on-request-confirm');

        // Act + Assert: empty
        expect(confirm).toBeDisabled();

        // Act + Assert: whitespace only
        await user.type(screen.getByTestId('account-close-on-request-reason'), '    ');
        expect(confirm).toBeDisabled();
        await user.click(confirm);
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('with a reason, calls the mutation with { userId, reason } and reports success', async () => {
        // Arrange
        const { onClosed } = renderCard();
        const { user } = await openDialog();

        // Act
        await user.type(
            screen.getByTestId('account-close-on-request-reason'),
            '  Juan lo pidió por correo  '
        );
        await user.click(screen.getByTestId('account-close-on-request-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith({
            userId: USER_ID,
            reason: 'Juan lo pidió por correo'
        });
        await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
        expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('a 409 says the account changed and reads the preview again, without retrying', async () => {
        // Arrange
        mutateAsync.mockRejectedValue(new ApiError('conflict', { status: 409 }));
        const { onClosed } = renderCard();
        const { user } = await openDialog();

        // Act
        await user.type(screen.getByTestId('account-close-on-request-reason'), 'pedido');
        await user.click(screen.getByTestId('account-close-on-request-confirm'));

        // Assert
        expect(await screen.findByTestId('account-close-on-request-notice')).toHaveTextContent(
            'cambió desde que abriste esta confirmación'
        );
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(mutateAsync).toHaveBeenCalledTimes(1);
        expect(onClosed).not.toHaveBeenCalled();
    });

    it('a 403 on the preview says it is done by another team account, with no action', async () => {
        // Arrange
        previewState.data = undefined;
        previewState.error = new ApiError('forbidden', { status: 403 });
        renderCard();

        // Act
        await openDialog();

        // Assert
        expect(screen.getByTestId('account-close-on-request-unavailable')).toHaveTextContent(
            'lo hace otra cuenta del equipo con el permiso'
        );
        expect(screen.queryByTestId('account-close-on-request-confirm')).not.toBeInTheDocument();
    });

    it('a 404 on the preview says the account is gone or already closed, with no action', async () => {
        // Arrange
        previewState.data = undefined;
        previewState.error = new ApiError('not found', { status: 404 });
        renderCard();

        // Act
        await openDialog();

        // Assert
        expect(screen.getByTestId('account-close-on-request-unavailable')).toHaveTextContent(
            'ya se dio de baja'
        );
        expect(screen.queryByTestId('account-close-on-request-confirm')).not.toBeInTheDocument();
    });

    it('while loading shows the spinner and no confirm button', async () => {
        // Arrange
        previewState.data = undefined;
        previewState.isLoading = true;
        renderCard();

        // Act
        await openDialog();

        // Assert
        expect(screen.getByTestId('account-close-on-request-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('account-close-on-request-confirm')).not.toBeInTheDocument();
    });
});
