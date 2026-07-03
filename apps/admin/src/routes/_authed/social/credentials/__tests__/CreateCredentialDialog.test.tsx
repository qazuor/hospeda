// @vitest-environment jsdom
/**
 * Component tests for CreateCredentialDialog (HOS-64 G-4, T-030).
 *
 * Strategy (mirrors ../../__tests__/platform-settings-pages.test.tsx): mock
 * the Radix-based Dialog/Select/Button/Input/Label primitives as plain DOM
 * passthroughs so jsdom doesn't need portal/pointer-event polyfills, and
 * mock the mutation hook + toast so submission is fully controllable.
 *
 * Covers: submit disabled until both key and plaintext are set (empty
 * plaintext rejected), successful submit calls the create mutation with the
 * right payload and closes the dialog (form fields reset).
 */

import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

vi.mock('@/features/social-credentials', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/social-credentials')>();
    return {
        ...actual,
        useCreateSocialCredentialMutation: vi.fn()
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

vi.mock('@/components/ui/select', () => ({
    Select: ({
        value,
        onValueChange,
        children
    }: {
        value?: string;
        onValueChange?: (value: string) => void;
        children: ReactNode;
    }) => (
        <select
            data-testid="social-credential-key-select"
            value={value}
            onChange={(e) => onValueChange?.(e.target.value)}
        >
            <option value="">-- select --</option>
            {children}
        </select>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
        <option value={value}>{children}</option>
    )
}));

import { useCreateSocialCredentialMutation } from '@/features/social-credentials';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreateCredentialDialog } from '../-components/CreateCredentialDialog';

const mockUseCreateSocialCredentialMutation = vi.mocked(useCreateSocialCredentialMutation);

describe('CreateCredentialDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('disables submit until a key is selected and a plaintext secret is entered', () => {
        mockUseCreateSocialCredentialMutation.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false
        } as unknown as ReturnType<typeof useCreateSocialCredentialMutation>);

        render(<CreateCredentialDialog />);

        const submitButton = screen.getByRole('button', { name: 'Crear' });
        expect(submitButton).toBeDisabled();

        fireEvent.change(screen.getByTestId('social-credential-key-select'), {
            target: { value: 'make_webhook_url' }
        });
        expect(submitButton).toBeDisabled();

        fireEvent.change(
            document.getElementById('create-social-credential-plaintext') as HTMLInputElement,
            { target: { value: '  ' } }
        );
        expect(submitButton).toBeDisabled();

        fireEvent.change(
            document.getElementById('create-social-credential-plaintext') as HTMLInputElement,
            { target: { value: 'https://hook.make.com/secret' } }
        );
        expect(submitButton).not.toBeDisabled();
    });

    it('calls the create mutation with key/plaintext/label and resets the form on success', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({ id: 'new-id', key: 'make_webhook_url' });
        mockUseCreateSocialCredentialMutation.mockReturnValue({
            mutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useCreateSocialCredentialMutation>);

        render(<CreateCredentialDialog />);

        fireEvent.change(screen.getByTestId('social-credential-key-select'), {
            target: { value: 'make_webhook_url' }
        });
        fireEvent.change(
            document.getElementById('create-social-credential-plaintext') as HTMLInputElement,
            { target: { value: 'https://hook.make.com/secret' } }
        );
        fireEvent.change(
            document.getElementById('create-social-credential-label') as HTMLInputElement,
            { target: { value: 'Production' } }
        );

        fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

        await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith({
            key: 'make_webhook_url',
            plaintext: 'https://hook.make.com/secret',
            label: 'Production'
        });

        // Form resets after a successful submit — the plaintext field is empty again.
        await vi.waitFor(() =>
            expect(
                (document.getElementById('create-social-credential-plaintext') as HTMLInputElement)
                    .value
            ).toBe('')
        );
    });

    it('does not call the mutation when submit is disabled', () => {
        const mutateAsync = vi.fn();
        mockUseCreateSocialCredentialMutation.mockReturnValue({
            mutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useCreateSocialCredentialMutation>);

        render(<CreateCredentialDialog />);

        fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
        expect(mutateAsync).not.toHaveBeenCalled();
    });
});
