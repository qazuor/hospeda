/**
 * @file ActionBar.test.tsx
 * @description Tests for ActionBar component — save/cancel buttons, loading state.
 */

import { ActionBar } from '@/components/host/editor/ActionBar.client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/ActionBar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

describe('ActionBar', () => {
    it('should render save and cancel buttons', () => {
        render(
            <ActionBar
                locale="es"
                isSaving={false}
                onCancel={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', async () => {
        const onCancel = vi.fn();
        const user = userEvent.setup();

        render(
            <ActionBar
                locale="es"
                isSaving={false}
                onCancel={onCancel}
            />
        );

        await user.click(screen.getByRole('button', { name: /cancelar/i }));
        expect(onCancel).toHaveBeenCalledOnce();
    });

    it('should disable save button and show saving text when isSaving is true', () => {
        render(
            <ActionBar
                locale="es"
                isSaving={true}
                onCancel={vi.fn()}
            />
        );

        const saveButton = screen.getByRole('button', { name: /guardando/i });
        expect(saveButton).toBeDisabled();
    });

    it('should disable cancel button while saving', () => {
        render(
            <ActionBar
                locale="es"
                isSaving={true}
                onCancel={vi.fn()}
            />
        );

        const cancelButton = screen.getByRole('button', { name: /cancelar/i });
        expect(cancelButton).toBeDisabled();
    });
});
