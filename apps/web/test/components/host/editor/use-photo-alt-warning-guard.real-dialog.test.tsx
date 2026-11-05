/**
 * @file use-photo-alt-warning-guard.real-dialog.test.tsx
 * @description "Completar ahora" must leave focus on the first incomplete
 * photo's alt field. The REAL confirmation dialog restores focus to the
 * previously focused element when it unmounts, so a focus request issued while
 * the dialog is still tearing down is undone. The sibling suite mocks the
 * dialog and cannot see that; this one renders it.
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoMetadataEditor } from '@/components/host/editor/PhotoMetadataEditor.client';
import { usePhotoAltWarningGuard } from '@/components/host/editor/use-photo-alt-warning-guard';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { __resetLeaveWarningRegistry } from '@/lib/forms/leave-warning-registry';

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) })
}));

const photo: AccommodationMediaItem = {
    id: 'real-dialog-photo',
    url: 'https://example.com/p.jpg',
    publicId: 'p',
    isFeatured: false,
    alt: ''
};

function editorProps(disabled: boolean) {
    return {
        locale: 'es' as const,
        item: photo,
        disabled,
        toggleAriaLabel: 'Editar textos',
        closeAriaLabel: 'Cerrar textos',
        onSave: vi.fn().mockResolvedValue(true)
    };
}

/** Opens the real dialog by clicking a focused in-app link, then picks "Completar ahora". */
async function leaveAndChooseCompleteNow(): Promise<void> {
    const link = document.createElement('a');
    link.setAttribute('href', '/es/mi-cuenta/propiedades/');
    link.textContent = 'leave';
    document.body.appendChild(link);
    link.focus();
    fireEvent.click(link);
    const button = await screen.findByRole('button', { name: 'Completar ahora' });
    fireEvent.click(button);
}

describe('"Completar ahora" with the real confirmation dialog', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        __resetLeaveWarningRegistry();
    });

    afterEach(() => {
        document.body.replaceChildren();
        __resetLeaveWarningRegistry();
        window.sessionStorage.clear();
    });

    function mountGuard(): void {
        renderHook(() =>
            usePhotoAltWarningGuard({
                locale: 'es',
                accommodationId: 'acc-real-dialog',
                featuredItem: null,
                galleryItems: [photo]
            })
        );
    }

    const field = (container: HTMLElement) =>
        container.querySelector<HTMLTextAreaElement>('#photo-alt-real-dialog-photo');

    it('keeps focus on the alt field when its panel is already open', async () => {
        const editor = render(<PhotoMetadataEditor {...editorProps(false)} />);
        fireEvent.click(editor.container.querySelector('button')!);
        mountGuard();

        await leaveAndChooseCompleteNow();

        await waitFor(() => expect(document.activeElement).toBe(field(editor.container)));
        await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
        expect(document.activeElement).toBe(field(editor.container));
    });

    it('opens a closed panel and keeps focus on its alt field', async () => {
        const editor = render(<PhotoMetadataEditor {...editorProps(false)} />);
        mountGuard();

        await leaveAndChooseCompleteNow();

        await waitFor(() => expect(document.activeElement).toBe(field(editor.container)));
        await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
        expect(document.activeElement).toBe(field(editor.container));
    });

    it('focuses the alt field once an in-flight operation finishes', async () => {
        const editor = render(<PhotoMetadataEditor {...editorProps(true)} />);
        mountGuard();

        await leaveAndChooseCompleteNow();
        await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
        editor.rerender(<PhotoMetadataEditor {...editorProps(false)} />);

        await waitFor(() => expect(document.activeElement).toBe(field(editor.container)));
        await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
        expect(document.activeElement).toBe(field(editor.container));
    });
});
