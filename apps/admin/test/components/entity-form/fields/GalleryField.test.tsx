/**
 * GalleryField component tests — dnd-kit a11y refactor (T-044).
 *
 * Covers:
 * 1. Renders without crashing with empty gallery.
 * 2. Renders sortable items and drag handles when images are provided.
 * 3. Remove button triggers onChange with the image removed.
 * 4. DndContext announcements API is wired (returns localized strings for
 *    onDragStart / onDragOver / onDragEnd / onDragCancel).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Capture the props passed to DndContext so we can inspect the
// announcements prop for screen-reader localization.
const dndContextSpy = vi.hoisted(() => vi.fn());

vi.mock('@dnd-kit/core', async () => {
    const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
    return {
        ...actual,
        DndContext: (props: {
            accessibility?: unknown;
            children: React.ReactNode;
        }) => {
            dndContextSpy(props);
            const Real = actual.DndContext;
            return <Real {...(props as React.ComponentProps<typeof Real>)} />;
        }
    };
});

import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { GalleryField, type GalleryImage } from '@/components/entity-form/fields/GalleryField';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { ModerationStatusEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildConfig = (overrides: Partial<FieldConfig> = {}): FieldConfig => ({
    id: 'photos',
    type: FieldTypeEnum.GALLERY,
    label: 'Gallery',
    typeConfig: {
        type: 'GALLERY',
        maxImages: 5,
        sortable: true,
        allowedTypes: ['image/jpeg', 'image/png'],
        maxSize: 5 * 1024 * 1024
    },
    ...overrides
});

const buildImage = (id: string, order: number): GalleryImage => ({
    id,
    url: `https://example.com/${id}.jpg`,
    alt: `Alt ${id}`,
    order,
    moderationState: ModerationStatusEnum.APPROVED
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GalleryField', () => {
    it('renders without crashing when given an empty gallery', () => {
        const onChange = vi.fn();

        render(
            <GalleryField
                config={buildConfig()}
                value={[]}
                onChange={onChange}
            />
        );

        // Empty gallery must not render the sortable list.
        expect(screen.queryByTestId('gallery-list')).not.toBeInTheDocument();
        // The upload dropzone is visible when under the image cap.
        expect(
            screen.getByLabelText('admin-entities.fields.gallery.uploadAriaLabel')
        ).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('renders a sortable item per image with drag + delete controls', () => {
        const images: GalleryImage[] = [buildImage('a', 0), buildImage('b', 1)];

        render(
            <GalleryField
                config={buildConfig()}
                value={images}
                onChange={vi.fn()}
            />
        );

        // One list item per image.
        expect(screen.getByTestId('gallery-item-0')).toBeInTheDocument();
        expect(screen.getByTestId('gallery-item-1')).toBeInTheDocument();

        // Drag handles wired by SortableGalleryItem (keyboard-reorder entry point).
        expect(screen.getByTestId('gallery-drag-handle-0')).toBeInTheDocument();
        expect(screen.getByTestId('gallery-drag-handle-1')).toBeInTheDocument();

        // Drag handle and delete buttons use the localized aria-labels.
        expect(
            screen.getByLabelText('admin-entities.fields.gallery.dnd.dragHandleLabel 1')
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('admin-entities.fields.gallery.deleteLabel 1')
        ).toBeInTheDocument();
    });

    it('removes the image from the gallery when the delete button is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const images: GalleryImage[] = [buildImage('a', 0), buildImage('b', 1)];

        render(
            <GalleryField
                config={buildConfig()}
                value={images}
                onChange={onChange}
            />
        );

        const deleteBtn = screen.getByLabelText('admin-entities.fields.gallery.deleteLabel 1');
        await user.click(deleteBtn);

        // onChange called with the first image removed, remaining reordered from 0.
        expect(onChange).toHaveBeenCalledTimes(1);
        const lastArg = onChange.mock.calls[0]?.[0] as GalleryImage[];
        expect(lastArg).toHaveLength(1);
        expect(lastArg[0]?.id).toBe('b');
        expect(lastArg[0]?.order).toBe(0);
    });

    it('wires a11y announcements that localize dnd-kit events', () => {
        dndContextSpy.mockClear();
        const images: GalleryImage[] = [buildImage('a', 0), buildImage('b', 1)];

        render(
            <GalleryField
                config={buildConfig()}
                value={images}
                onChange={vi.fn()}
            />
        );

        expect(dndContextSpy).toHaveBeenCalled();

        type AnnouncementsArg = {
            accessibility?: {
                announcements: {
                    onDragStart: (evt: { active: { id: string } }) => string | undefined;
                    onDragOver: (evt: {
                        active: { id: string };
                        over: { id: string } | null;
                    }) => string | undefined;
                    onDragEnd: (evt: {
                        active: { id: string };
                        over: { id: string } | null;
                    }) => string | undefined;
                    onDragCancel: (evt: { active: { id: string } }) => string | undefined;
                };
            };
        };

        const lastCall = dndContextSpy.mock.calls[0]?.[0] as AnnouncementsArg;
        expect(lastCall?.accessibility).toBeDefined();
        const ann = lastCall?.accessibility?.announcements;
        expect(typeof ann?.onDragStart).toBe('function');
        expect(typeof ann?.onDragOver).toBe('function');
        expect(typeof ann?.onDragEnd).toBe('function');
        expect(typeof ann?.onDragCancel).toBe('function');

        // t() is globally mocked to return the key verbatim (see test/setup.tsx).
        expect(ann?.onDragStart({ active: { id: 'a' } })).toBe(
            'admin-entities.fields.gallery.dnd.onDragStart'
        );
        expect(ann?.onDragOver({ active: { id: 'a' }, over: { id: 'b' } })).toBe(
            'admin-entities.fields.gallery.dnd.onDragOver'
        );
        expect(ann?.onDragEnd({ active: { id: 'a' }, over: { id: 'b' } })).toBe(
            'admin-entities.fields.gallery.dnd.onDragEnd'
        );
        expect(ann?.onDragCancel({ active: { id: 'a' } })).toBe(
            'admin-entities.fields.gallery.dnd.onDragCancel'
        );
    });
});

describe('GalleryField — items loaded from the API without id/order', () => {
    // media.gallery items only carry url/caption/description/moderationState.
    // The frontend-only id/order are absent until GalleryField backfills them.
    const buildApiImage = (slug: string): GalleryImage =>
        ({
            url: `https://example.com/${slug}.jpg`,
            moderationState: ModerationStatusEnum.APPROVED
        }) as unknown as GalleryImage;

    it('renders one item per image when id/order are missing', () => {
        // Regression: without the id backfill these items shared `key={undefined}`,
        // triggering React's duplicate-key warning and collapsing the list.
        render(
            <GalleryField
                config={buildConfig()}
                value={[buildApiImage('first'), buildApiImage('second')]}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByTestId('gallery-item-0')).toBeInTheDocument();
        expect(screen.getByTestId('gallery-item-1')).toBeInTheDocument();
    });

    it('removes exactly the targeted image when id is derived from url', async () => {
        // Regression: remove keyed off `img.id`, which was undefined for every
        // API-loaded item, so the filter matched none (or all) instead of one.
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <GalleryField
                config={buildConfig()}
                value={[buildApiImage('first'), buildApiImage('second')]}
                onChange={onChange}
            />
        );

        await user.click(screen.getByLabelText('admin-entities.fields.gallery.deleteLabel 1'));

        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0]?.[0] as GalleryImage[];
        expect(next).toHaveLength(1);
        expect(next[0]?.url).toBe('https://example.com/second.jpg');
    });
});
