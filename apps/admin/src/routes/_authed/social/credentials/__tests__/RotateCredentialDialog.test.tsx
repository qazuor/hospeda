// @vitest-environment jsdom
/**
 * Component tests for RotateCredentialDialog (HOS-64 G-4, T-030).
 *
 * Same mocking strategy as CreateCredentialDialog.test.tsx.
 *
 * Covers: submit disabled until a new secret is entered (empty plaintext
 * rejected), successful submit calls the rotate mutation with the right
 * key/payload and closes the dialog (resets the field).
 */

import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

vi.mock('@/features/social-credentials', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/social-credentials')>();
    return {
        ...actual,
        useRotateSocialCredentialMutation: vi.fn()
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

vi.mock('@/components/ui/input', () => ({
    Input: ({
        id,
        value,
        onChange,
        type
    }: {
        id?: string;
        value?: string;
        onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
        type?: string;
    }) => (
        <input
            id={id}
            value={value}
            onChange={onChange}
            type={type ?? 'text'}
        />
    )
}));

vi.mock('@/components/ui/label', () => ({
    Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
        <label htmlFor={htmlFor}>{children}</label>
    )
}));

import { useRotateSocialCredentialMutation } from '@/features/social-credentials';
import { fireEvent, render, screen } from '@testing-library/react';
import { RotateCredentialDialog } from '../-components/RotateCredentialDialog';

const mockUseRotateSocialCredentialMutation = vi.mocked(useRotateSocialCredentialMutation);

describe('RotateCredentialDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('disables submit until a new secret is entered', () => {
        mockUseRotateSocialCredentialMutation.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false
        } as unknown as ReturnType<typeof useRotateSocialCredentialMutation>);

        render(
            <RotateCredentialDialog
                credentialKey="make_webhook_url"
                currentLabel="Production webhook"
            />
        );

        const submitButton = screen.getByRole('button', { name: 'Rotar' });
        expect(submitButton).toBeDisabled();

        const input = document.getElementById(
            'rotate-social-credential-make_webhook_url'
        ) as HTMLInputElement;
        fireEvent.change(input, { target: { value: '   ' } });
        expect(submitButton).toBeDisabled();

        fireEvent.change(input, { target: { value: 'https://hook.make.com/new-secret' } });
        expect(submitButton).not.toBeDisabled();
    });

    it('calls the rotate mutation with the key and new plaintext, then resets the field', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({ id: 'new-id', key: 'make_webhook_url' });
        mockUseRotateSocialCredentialMutation.mockReturnValue({
            mutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useRotateSocialCredentialMutation>);

        render(
            <RotateCredentialDialog
                credentialKey="make_webhook_url"
                currentLabel={null}
            />
        );

        const input = document.getElementById(
            'rotate-social-credential-make_webhook_url'
        ) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'https://hook.make.com/new-secret' } });
        fireEvent.click(screen.getByRole('button', { name: 'Rotar' }));

        await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith({
            key: 'make_webhook_url',
            payload: { newPlaintext: 'https://hook.make.com/new-secret' }
        });

        await vi.waitFor(() => expect(input.value).toBe(''));
    });

    it('does not call the mutation when submit is disabled', () => {
        const mutateAsync = vi.fn();
        mockUseRotateSocialCredentialMutation.mockReturnValue({
            mutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useRotateSocialCredentialMutation>);

        render(
            <RotateCredentialDialog
                credentialKey="operator_pin"
                currentLabel={null}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Rotar' }));
        expect(mutateAsync).not.toHaveBeenCalled();
    });
});
