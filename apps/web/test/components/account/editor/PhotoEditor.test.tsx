/** Behavioral contract of the shared host/listing photo composition. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoEditor, type PhotoEditorProps } from '@/components/account/editor/PhotoEditor';
import { sectionHelpId } from '@/lib/help/section-help-id';

vi.mock('@/lib/logger', () => ({ webLogger: { error: vi.fn() } }));

function props(overrides: Partial<PhotoEditorProps> = {}): PhotoEditorProps {
    return {
        locale: 'es',
        helpId: sectionHelpId({ vertical: 'venue', slug: 'fotos' }),
        featured: (
            <img
                src="/cover.jpg"
                alt="Cover"
            />
        ),
        gallery: (
            <img
                src="/gallery.jpg"
                alt="Garden"
            />
        ),
        galleryLabel: 'Gallery',
        galleryInputId: 'gallery-upload',
        galleryInput: (
            <input
                id="gallery-upload"
                type="file"
            />
        ),
        galleryPicker: { title: 'Add gallery photo', onPick: vi.fn() },
        ...overrides
    };
}

describe('PhotoEditor', () => {
    it('owns one help-linked Section and the cover/gallery composition', () => {
        const { container } = render(<PhotoEditor {...props()} />);
        expect(
            screen.getByRole('heading', { level: 2, name: 'Portada y galería de fotos' })
        ).toBeVisible();
        const section = container.querySelector('[data-kit-section]');
        expect(section).toHaveAttribute('data-help', 'section:venue.fotos');
        expect(container.querySelectorAll('[data-kit-section]')).toHaveLength(1);
        expect(section).toContainElement(screen.getByAltText('Cover'));
        expect(section).toContainElement(screen.getByAltText('Garden'));
    });

    it('provides a Field hint and a visible icon with an accessible add name', () => {
        const onPick = vi.fn();
        render(
            <PhotoEditor {...props({ galleryPicker: { title: 'Add gallery photo', onPick } })} />
        );
        const add = screen.getByRole('button', { name: 'Add gallery photo' });
        expect(add.querySelector('svg')).not.toBeNull();
        expect(screen.getByText('JPG, PNG, WebP o HEIC - max 10MB')).toHaveAttribute(
            'id',
            'gallery-upload-hint'
        );
        fireEvent.click(add);
        expect(onPick).toHaveBeenCalledOnce();
    });

    it('removes the add tile at the cap without hiding existing photos', () => {
        render(<PhotoEditor {...props({ galleryPicker: undefined })} />);
        expect(screen.queryByRole('button', { name: 'Add gallery photo' })).toBeNull();
        expect(screen.getByAltText('Garden')).toBeVisible();
    });

    it('uses the same translated composition in English', () => {
        render(<PhotoEditor {...props({ locale: 'en' })} />);
        expect(screen.getByRole('heading', { name: 'Cover and photo gallery' })).toBeVisible();
        expect(screen.getByText('JPG, PNG, WebP or HEIC - max 10MB')).toBeVisible();
    });
});
