// @vitest-environment jsdom
/**
 * Component tests for EditCredentialDialog (HOS-64 G-4, T-031).
 *
 * Same mocking strategy as CreateCredentialDialog.test.tsx / RotateCredentialDialog.test.tsx.
 *
 * Covers: opening the dialog pre-fills the label from the credential,
 * submitting calls the update mutation with { key, payload: { label } },
 * and closes the dialog on success.
 */

import type { ReactElement, ReactNode } from 'react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

vi.mock('@/features/social-credentials', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/social-credentials')>();
    return {
        ...actual,
        useUpdateSocialCredentialMutation: vi.fn()
    };
});

// Dialog is mocked with a real React context so DialogTrigger's click can
// route through the component's own `onOpenChange` — needed here (unlike
// the Create/Rotate dialog tests) because EditCredentialDialog pre-fills its
// label field inside `onOpenChange`, not from a plain initial state.
const DialogOpenChangeContext = React.createContext<(open: boolean) => void>(() => {});

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({
        children,
        onOpenChange
    }: {
        children: ReactNode;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
    }) => (
        <DialogOpenChangeContext.Provider value={onOpenChange ?? (() => {})}>
            <div>{children}</div>
        </DialogOpenChangeContext.Provider>
    ),
    DialogTrigger: ({ children }: { children: ReactElement<{ onClick?: () => void }> }) => {
        const onOpenChange = React.useContext(DialogOpenChangeContext);
        return React.cloneElement(children, { onClick: () => onOpenChange(true) });
    },
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

vi.mock('@/components/ui/input', () => ({
    Input: ({
        id,
        value,
        onChange
    }: {
        id?: string;
        value?: string;
        onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    }) => (
        <input
            id={id}
            value={value}
            onChange={onChange}
        />
    )
}));

vi.mock('@/components/ui/label', () => ({
    Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
        <label htmlFor={htmlFor}>{children}</label>
    )
}));

import { fireEvent, render, screen } from '@testing-library/react';
import type { SocialCredentialMasked } from '@/features/social-credentials';
import { useUpdateSocialCredentialMutation } from '@/features/social-credentials';
import { EditCredentialDialog } from '../-components/EditCredentialDialog';

const mockUseUpdateSocialCredentialMutation = vi.mocked(useUpdateSocialCredentialMutation);

const MASKED_CREDENTIAL: SocialCredentialMasked = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    key: 'make_webhook_url',
    label: 'Production webhook',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null
};

describe('EditCredentialDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pre-fills the label input from the credential when the dialog opens', () => {
        mockUseUpdateSocialCredentialMutation.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false
        } as unknown as ReturnType<typeof useUpdateSocialCredentialMutation>);

        render(<EditCredentialDialog credential={MASKED_CREDENTIAL} />);
        fireEvent.click(screen.getByRole('button', { name: /Editar/ }));

        const input = document.getElementById(
            'edit-social-credential-label-make_webhook_url'
        ) as HTMLInputElement;
        expect(input.value).toBe('Production webhook');
    });

    it('calls the update mutation with { key, payload: { label } } on submit', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({ id: 'x', key: 'make_webhook_url' });
        mockUseUpdateSocialCredentialMutation.mockReturnValue({
            mutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useUpdateSocialCredentialMutation>);

        render(<EditCredentialDialog credential={MASKED_CREDENTIAL} />);
        fireEvent.click(screen.getByRole('button', { name: /Editar/ }));

        const input = document.getElementById(
            'edit-social-credential-label-make_webhook_url'
        ) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'New label' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith({
            key: 'make_webhook_url',
            payload: { label: 'New label' }
        });
    });
});
