// @vitest-environment jsdom
/**
 * Component tests for EditCredentialDialog's "change the API key from Edit"
 * follow-up (HOS-94 owner adjustment).
 *
 * Mocking strategy mirrors the sibling
 * `routes/_authed/social/credentials/__tests__/EditCredentialDialog.test.tsx`
 * (Dialog/Button/Input/Label stubs driven by a real React context so
 * `DialogTrigger`'s click routes through the component's own
 * `onOpenChange`), plus the identity-`t` i18n mock used by
 * `SyncModelsSection.test.tsx` so assertions stay stable across copy changes.
 *
 * Covers:
 * - Leaving the "new API key" field empty persists label/metadata only —
 *   the rotate mutation is never called.
 * - Providing a new key calls the rotate mutation BEFORE the update
 *   mutation (rotate-then-update ordering, see the inline comment in
 *   `EditCredentialDialog.handleSubmit`).
 */

import type { ReactElement, ReactNode } from 'react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}::${JSON.stringify(params)}` : key
    })
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

vi.mock('@/features/ai-settings', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/ai-settings')>();
    return {
        ...actual,
        useUpdateAiCredentialMutation: vi.fn(),
        useRotateAiCredentialMutation: vi.fn(),
        useSyncModelsMutation: vi.fn()
    };
});

// Dialog is mocked with a real React context so DialogTrigger's click can
// route through the component's own `onOpenChange` — needed because
// EditCredentialDialog pre-fills its fields inside `onOpenChange`.
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
        onChange,
        type
    }: {
        id?: string;
        value?: string;
        type?: string;
        onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    }) => (
        <input
            id={id}
            type={type}
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
import type { AiCredentialMasked } from '@/features/ai-settings';
import {
    useRotateAiCredentialMutation,
    useSyncModelsMutation,
    useUpdateAiCredentialMutation
} from '@/features/ai-settings';
import { EditCredentialDialog } from '../credentials';

const mockUseUpdateAiCredentialMutation = vi.mocked(useUpdateAiCredentialMutation);
const mockUseRotateAiCredentialMutation = vi.mocked(useRotateAiCredentialMutation);
const mockUseSyncModelsMutation = vi.mocked(useSyncModelsMutation);

const MASKED_CREDENTIAL: AiCredentialMasked = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    providerId: 'openai',
    label: 'Production key',
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null
};

function idleSyncMutation(): ReturnType<typeof useSyncModelsMutation> {
    return {
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        data: undefined,
        error: null,
        isPending: false,
        isError: false,
        isSuccess: false
    } as unknown as ReturnType<typeof useSyncModelsMutation>;
}

describe('EditCredentialDialog — API key change (HOS-94 owner adjustment)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSyncModelsMutation.mockReturnValue(idleSyncMutation());
    });

    it('persists label/metadata only and never calls rotate when the key field is left empty', async () => {
        const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'x', providerId: 'openai' });
        const rotateMutateAsync = vi.fn().mockResolvedValue({ id: 'x', providerId: 'openai' });
        mockUseUpdateAiCredentialMutation.mockReturnValue({
            mutateAsync: updateMutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useUpdateAiCredentialMutation>);
        mockUseRotateAiCredentialMutation.mockReturnValue({
            mutateAsync: rotateMutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useRotateAiCredentialMutation>);

        render(<EditCredentialDialog credential={MASKED_CREDENTIAL} />);
        fireEvent.click(screen.getByRole('button', { name: /Editar/ }));

        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await vi.waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
        expect(rotateMutateAsync).not.toHaveBeenCalled();
        expect(updateMutateAsync).toHaveBeenCalledWith({
            providerId: 'openai',
            payload: { label: 'Production key', metadata: undefined }
        });
    });

    it('rotates the key before persisting metadata when a new key is provided', async () => {
        const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'x', providerId: 'openai' });
        const rotateMutateAsync = vi.fn().mockResolvedValue({ id: 'x', providerId: 'openai' });
        mockUseUpdateAiCredentialMutation.mockReturnValue({
            mutateAsync: updateMutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useUpdateAiCredentialMutation>);
        mockUseRotateAiCredentialMutation.mockReturnValue({
            mutateAsync: rotateMutateAsync,
            isPending: false
        } as unknown as ReturnType<typeof useRotateAiCredentialMutation>);

        render(<EditCredentialDialog credential={MASKED_CREDENTIAL} />);
        fireEvent.click(screen.getByRole('button', { name: /Editar/ }));

        const newKeyInput = document.getElementById('edit-api-key-openai') as HTMLInputElement;
        fireEvent.change(newKeyInput, { target: { value: 'sk-new-secret' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await vi.waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
        expect(rotateMutateAsync).toHaveBeenCalledWith({
            providerId: 'openai',
            payload: { newPlaintextKey: 'sk-new-secret' }
        });

        // Rotate must resolve before the metadata update fires (rotate-then-update).
        const rotateOrder = rotateMutateAsync.mock.invocationCallOrder[0];
        const updateOrder = updateMutateAsync.mock.invocationCallOrder[0];
        expect(rotateOrder).toBeDefined();
        expect(updateOrder).toBeDefined();
        expect(rotateOrder as number).toBeLessThan(updateOrder as number);
    });
});
