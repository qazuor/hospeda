/**
 * HOS-372 regression — VideoGalleryField must survive a null value.
 *
 * The field used to be addressed as `media.videos`, which resolved to `undefined`
 * whenever the blob was absent, so the `value = []` parameter default covered it.
 * It now reads the top-level `videos` column, which is NULLABLE — and a parameter
 * default only fires on `undefined`, never on `null`. Every listing seeded before
 * a video was added therefore crashed the whole edit page with
 * "Cannot read properties of null (reading 'length')".
 *
 * Caught by browser smoke, not by tests: every existing test supplied an array.
 *
 * @module components/entity-form/fields/__tests__/VideoGalleryField.nullvalue
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FieldConfig } from '../../types/field-config.types';
import { VideoGalleryField } from '../VideoGalleryField';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key
    })
}));

const config = {
    id: 'videos',
    type: 'VIDEO_GALLERY',
    label: 'Galería de Videos',
    required: false,
    modes: ['edit'],
    typeConfig: { type: 'VIDEO_GALLERY' }
} as unknown as FieldConfig;

describe('VideoGalleryField — null value (HOS-372)', () => {
    it('renders the empty state instead of throwing when value is null', () => {
        // `null` is what the nullable `videos` column hands the form for any
        // listing that has never had a video. A parameter default does not cover it.
        expect(() =>
            render(
                <VideoGalleryField
                    config={config}
                    value={null as unknown as never}
                    onChange={vi.fn()}
                />
            )
        ).not.toThrow();

        expect(screen.getByText(/Todavía no hay videos/i)).toBeInTheDocument();
    });

    it('still renders the empty state when value is undefined', () => {
        expect(() =>
            render(
                <VideoGalleryField
                    config={config}
                    value={undefined}
                    onChange={vi.fn()}
                />
            )
        ).not.toThrow();
    });

    it('renders supplied entries when value is a populated array', () => {
        render(
            <VideoGalleryField
                config={config}
                value={[
                    {
                        url: 'https://youtu.be/abc',
                        moderationState: 'APPROVED'
                    } as unknown as never
                ]}
                onChange={vi.fn()}
            />
        );

        expect(screen.queryByText(/Todavía no hay videos/i)).not.toBeInTheDocument();
    });
});
