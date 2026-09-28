/**
 * @file PhotoMetadataEditor.nested-form.test.tsx
 * @description Regression test for HOS-1297. Every editor that mounts
 * `PhotoMetadataEditor` (post, event, gastronomy/experience) wraps the whole
 * page in its own `<form>`. The panel used to render its own `<form onSubmit>`,
 * which is a nested form: the HTML parser drops the inner one, so "Guardar"
 * submitted the OUTER form natively (a GET, page reload) and never reached the
 * API. The panel is therefore rendered here INSIDE a real parent `<form>`, as
 * the editors do, and the save must call `onSave` without submitting it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoMetadataEditor } from '@/components/host/editor/PhotoMetadataEditor.client';
import type { AccommodationMediaItem } from '@/lib/api/types';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key,
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

function renderInsideParentForm() {
    const onOuterSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const onSave = vi.fn().mockResolvedValue(true);
    const view = render(
        <form
            data-testid="outer-form"
            onSubmit={onOuterSubmit}
        >
            <PhotoMetadataEditor
                locale="es"
                item={ITEM}
                disabled={false}
                toggleAriaLabel="Editar textos de la foto 1"
                closeAriaLabel="Cerrar edición de textos de la foto 1"
                onSave={onSave}
            />
        </form>
    );
    fireEvent.click(screen.getByLabelText('Editar textos de la foto 1'));
    return { ...view, onOuterSubmit, onSave };
}

describe('PhotoMetadataEditor inside a parent <form> (HOS-1297)', () => {
    it('does not render a nested <form>, and the markup survives an HTML re-parse', () => {
        const { container } = renderInsideParentForm();

        expect(container.querySelectorAll('form')).toHaveLength(1);

        // The real failure happens in the HTML parser (SSR output / innerHTML),
        // not in React's DOM calls: re-parse and confirm nothing gets dropped.
        const reparsed = document.createElement('div');
        reparsed.innerHTML = container.innerHTML;
        expect(reparsed.querySelectorAll('form')).toHaveLength(1);
        const save = Array.from(reparsed.querySelectorAll('button')).find(
            (b) => b.textContent === 'Guardar'
        );
        expect(save?.getAttribute('type')).toBe('button');
    });

    it('calls onSave on Guardar and does NOT submit the outer form', async () => {
        const { onSave, onOuterSubmit } = renderInsideParentForm();

        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'Dormitorio principal' }
        });
        fireEvent.click(screen.getByText('Guardar'));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                ITEM,
                expect.objectContaining({ alt: 'Dormitorio principal' })
            );
        });
        expect(onOuterSubmit).not.toHaveBeenCalled();
    });

    it('saves on Enter in a single-line input without submitting the outer form', async () => {
        const { onSave, onOuterSubmit } = renderInsideParentForm();

        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'Vista al jardín' }
        });
        fireEvent.keyDown(screen.getByLabelText('Epígrafe (opcional)'), { key: 'Enter' });

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledTimes(1);
        });
        expect(onOuterSubmit).not.toHaveBeenCalled();
    });

    it('does not save on Enter inside the alt textarea (newline, not submit)', () => {
        const { onSave } = renderInsideParentForm();
        fireEvent.keyDown(screen.getByLabelText('¿Qué muestra la foto?'), { key: 'Enter' });
        expect(onSave).not.toHaveBeenCalled();
    });
});
