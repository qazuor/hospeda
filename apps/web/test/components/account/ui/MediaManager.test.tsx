/**
 * Tests for the MediaManager kit pieces (HOS-2489): MediaDropzone,
 * MediaUploadStatus, PhotoGrid and PhotoTile, plus the PhotoAltBadge both
 * photo editors lay over a tile.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    MediaDropzone,
    MediaUploadStatus,
    PhotoGrid,
    PhotoTile
} from '../../../../src/components/account/ui';
import { PhotoAltBadge } from '../../../../src/components/host/editor/PhotoAltBadge';
import { createT } from '../../../../src/lib/i18n';

describe('MediaDropzone', () => {
    it('is a button named by its title that opens the picker', () => {
        // Arrange
        const onPick = vi.fn();
        render(
            <MediaDropzone
                title="Agregar foto"
                hint="JPG o PNG"
                onPick={onPick}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Agregar foto/ }));

        // Assert
        expect(onPick).toHaveBeenCalledTimes(1);
        expect(screen.getByText('JPG o PNG')).toBeInTheDocument();
    });

    it('hands dropped files to onDrop and flags the drag-over state', () => {
        // Arrange
        const onDrop = vi.fn();
        render(
            <MediaDropzone
                title="Agregar foto"
                variant="tile"
                isDragOver
                onPick={vi.fn()}
                onDrop={onDrop}
            />
        );
        const zone = screen.getByRole('button', { name: /Agregar foto/ });

        // Act
        fireEvent.drop(zone, { dataTransfer: { files: [] } });

        // Assert
        expect(onDrop).toHaveBeenCalledTimes(1);
        expect(zone).toHaveAttribute('data-drag-over', 'true');
    });

    it('does not open the picker while disabled', () => {
        // Arrange
        const onPick = vi.fn();
        render(
            <MediaDropzone
                title="Agregar foto"
                disabled
                onPick={onPick}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Agregar foto/ }));

        // Assert
        expect(onPick).not.toHaveBeenCalled();
    });

    it('keeps its icon out of the accessible name', () => {
        // Arrange + Act
        render(
            <MediaDropzone
                title="Agregar foto"
                onPick={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByRole('button').textContent).not.toContain('icon');
        expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeInTheDocument();
    });
});

describe('MediaUploadStatus', () => {
    it('announces the label politely and shows a native progress bar', () => {
        // Arrange + Act
        render(
            <MediaUploadStatus
                label="Subiendo foto…"
                progress={40}
                progressLabel="40%"
            />
        );

        // Assert
        expect(screen.getByRole('status')).toHaveTextContent('Subiendo foto…');
        expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40');
    });

    it('renders no progress bar before the upload reports one', () => {
        // Arrange + Act
        render(<MediaUploadStatus label="Procesando imagen…" />);

        // Assert
        expect(screen.queryByRole('progressbar')).toBeNull();
    });
});

describe('PhotoGrid', () => {
    it('is a labelled group only when given a label', () => {
        // Arrange + Act
        const { rerender } = render(
            <PhotoGrid ariaLabel="Galería">
                <span>a</span>
            </PhotoGrid>
        );

        // Assert
        expect(screen.getByRole('group', { name: 'Galería' })).toBeInTheDocument();
        rerender(
            <PhotoGrid>
                <span>a</span>
            </PhotoGrid>
        );
        expect(screen.queryByRole('group')).toBeNull();
    });
});

describe('PhotoTile', () => {
    it('renders the image with its actions, badge, toolbar and body', () => {
        // Arrange + Act
        render(
            <PhotoTile
                src="/photo.jpg"
                alt="Frente de la casa"
                sortableId="m-1"
                actions={<button type="button">Eliminar</button>}
                badge={<span>Falta la descripción</span>}
                toolbar={<button type="button">Subir</button>}
            >
                <p>Textos</p>
            </PhotoTile>
        );

        // Assert
        expect(screen.getByRole('img', { name: 'Frente de la casa' })).toHaveAttribute(
            'src',
            '/photo.jpg'
        );
        expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Subir' })).toBeInTheDocument();
        expect(screen.getByText('Falta la descripción')).toBeInTheDocument();
        expect(screen.getByText('Textos')).toBeInTheDocument();
        expect(document.querySelector('[data-sortable-id="m-1"]')).not.toBeNull();
    });
});

describe('PhotoAltBadge', () => {
    const t = createT('es');

    it('warns when a saved photo has no description', () => {
        // Arrange + Act
        render(
            <PhotoAltBadge
                locale="es"
                item={{ id: 'm-1', alt: '' }}
            />
        );

        // Assert
        expect(screen.getByText(t('host.properties.editor.photo.altMissing'))).toBeInTheDocument();
    });

    it('stays silent for a described photo', () => {
        // Arrange + Act
        const { container } = render(
            <PhotoAltBadge
                locale="es"
                item={{ id: 'm-1', alt: 'Frente de la casa' }}
            />
        );

        // Assert
        expect(container.textContent).toBe('');
    });

    it('stays silent for an SSR placeholder with no id yet', () => {
        // Arrange + Act
        const { container } = render(
            <PhotoAltBadge
                locale="es"
                item={{ id: '', alt: '' }}
            />
        );

        // Assert
        expect(container.textContent).toBe('');
    });
});
