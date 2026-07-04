// @vitest-environment jsdom
/**
 * Component tests for DeleteCredentialDialog (HOS-64 G-4, T-031).
 *
 * Same mocking strategy as the other credential dialog tests.
 *
 * Covers: the confirmation dialog does not call the delete mutation until
 * the destructive "Eliminar" button is explicitly clicked, and clicking it
 * calls the delete mutation with the credential key.
 */

import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

vi.mock('@/features/social-credentials', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/social-credentials')>();
    return {
        ...actual,
        useDeleteSocialCredentialMutation: vi.fn()
    };
});

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({
        children,
        onClick,
        disabled
    }: {
        children: ReactNode;
        onClick?: () => void;
        disabled?: boolean;
    }) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    )
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { useDeleteSocialCredentialMutation } from '@/features/social-credentials';
import { DeleteCredentialDialog } from '../-components/DeleteCredentialDialog';

const mockUseDeleteSocialCredentialMutation = vi.mocked(useDeleteSocialCredentialMutation);

describe('DeleteCredentialDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not call the delete mutation just from rendering — requires the confirm click', () => {
        const mutateAsync = vi.fn();
        mockUseDeleteSocialCredentialMutation.mockReturnValue({
            mutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useDeleteSocialCredentialMutation>);

        render(
            <DeleteCredentialDialog
                credentialKey="make_webhook_url"
                currentLabel="Production webhook"
            />
        );

        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('calls the delete mutation with the credential key when "Eliminar" is confirmed', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({ key: 'make_webhook_url' });
        mockUseDeleteSocialCredentialMutation.mockReturnValue({
            mutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useDeleteSocialCredentialMutation>);

        render(
            <DeleteCredentialDialog
                credentialKey="make_webhook_url"
                currentLabel="Production webhook"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

        await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith('make_webhook_url');
    });

    it('the "Cancelar" button never calls the delete mutation', () => {
        const mutateAsync = vi.fn();
        mockUseDeleteSocialCredentialMutation.mockReturnValue({
            mutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useDeleteSocialCredentialMutation>);

        render(
            <DeleteCredentialDialog
                credentialKey="operator_pin"
                currentLabel={null}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(mutateAsync).not.toHaveBeenCalled();
    });
});
