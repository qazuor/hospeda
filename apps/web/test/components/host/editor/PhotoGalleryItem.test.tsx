/**
 * @file PhotoGalleryItem.test.tsx
 * @description Unit tests for the per-photo gallery item (HOS-122): renders
 * as a real `<button>` toolbar (keyboard-operable by default, per the owner's
 * accessibility requirement — reorder is button-driven, not drag-and-drop),
 * wires each action to its callback with the right item, and disables
 * everything appropriately at the boundaries / while disabled.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PhotoGalleryItemProps } from '@/components/host/editor/PhotoGalleryItem.client';
import { PhotoGalleryItem } from '@/components/host/editor/PhotoGalleryItem.client';
import type { AccommodationMediaItem } from '@/lib/api/types';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        },
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

const ITEM: AccommodationMediaItem = {
    id: 'media-1',
    url: 'https://cdn.example.com/photo.jpg',
    publicId: 'gallery/media-1',
    isFeatured: false
};

function makeProps(overrides: Partial<PhotoGalleryItemProps> = {}): PhotoGalleryItemProps {
    return {
        locale: 'es',
        item: ITEM,
        position: 2,
        isFirst: false,
        isLast: false,
        disabled: false,
        onRemove: vi.fn(),
        onPromote: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        ...overrides
    };
}

describe('PhotoGalleryItem', () => {
    it('renders every action as a real <button> — keyboard-operable by default', () => {
        render(<PhotoGalleryItem {...makeProps()} />);
        for (const name of [
            'Eliminar',
            'Mover foto 2 hacia arriba',
            'Mover foto 2 hacia abajo',
            'Usar foto 2 como portada'
        ]) {
            const el = screen.getByLabelText(name);
            expect(el.tagName).toBe('BUTTON');
        }
    });

    it('calls onRemove with the item when the remove button is clicked', () => {
        const onRemove = vi.fn();
        render(<PhotoGalleryItem {...makeProps({ onRemove })} />);
        fireEvent.click(screen.getByLabelText('Eliminar'));
        expect(onRemove).toHaveBeenCalledWith(ITEM);
    });

    it('calls onPromote with the item when the portada button is clicked', () => {
        const onPromote = vi.fn();
        render(<PhotoGalleryItem {...makeProps({ onPromote })} />);
        fireEvent.click(screen.getByLabelText('Usar foto 2 como portada'));
        expect(onPromote).toHaveBeenCalledWith(ITEM);
    });

    it('calls onMoveUp / onMoveDown with the item', () => {
        const onMoveUp = vi.fn();
        const onMoveDown = vi.fn();
        render(<PhotoGalleryItem {...makeProps({ onMoveUp, onMoveDown })} />);
        fireEvent.click(screen.getByLabelText('Mover foto 2 hacia arriba'));
        fireEvent.click(screen.getByLabelText('Mover foto 2 hacia abajo'));
        expect(onMoveUp).toHaveBeenCalledWith(ITEM);
        expect(onMoveDown).toHaveBeenCalledWith(ITEM);
    });

    it('disables move-up when isFirst is true', () => {
        render(<PhotoGalleryItem {...makeProps({ isFirst: true })} />);
        expect(screen.getByLabelText('Mover foto 2 hacia arriba')).toBeDisabled();
        expect(screen.getByLabelText('Mover foto 2 hacia abajo')).not.toBeDisabled();
    });

    it('disables move-down when isLast is true', () => {
        render(<PhotoGalleryItem {...makeProps({ isLast: true })} />);
        expect(screen.getByLabelText('Mover foto 2 hacia abajo')).toBeDisabled();
        expect(screen.getByLabelText('Mover foto 2 hacia arriba')).not.toBeDisabled();
    });

    it('disables every action when disabled is true', () => {
        render(<PhotoGalleryItem {...makeProps({ disabled: true })} />);
        expect(screen.getByLabelText('Eliminar')).toBeDisabled();
        expect(screen.getByLabelText('Mover foto 2 hacia arriba')).toBeDisabled();
        expect(screen.getByLabelText('Mover foto 2 hacia abajo')).toBeDisabled();
        expect(screen.getByLabelText('Usar foto 2 como portada')).toBeDisabled();
    });

    it('disables every action when the item has no DB id yet (SSR placeholder)', () => {
        render(<PhotoGalleryItem {...makeProps({ item: { ...ITEM, id: '' } })} />);
        expect(screen.getByLabelText('Eliminar')).toBeDisabled();
        expect(screen.getByLabelText('Mover foto 2 hacia arriba')).toBeDisabled();
    });
});
