/** Reading-time copy must describe clearing, not retaining the loaded value. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DetailsSection } from '@/components/post/editor/DetailsSection.client';
import {
    buildPostPatchPayload,
    type PostEditFormData
} from '@/components/post/editor/post-edit-data';

const data: PostEditFormData = {
    title: '',
    summary: '',
    content: '',
    category: '',
    relatedDestinationId: '',
    readingTimeMinutes: 5
};

describe('DetailsSection reading time', () => {
    it('explains resetting a loaded reading time and changes to an empty-state hint', () => {
        const onReadingTimeChange = vi.fn();
        const input = {
            locale: 'en' as const,
            data,
            destinations: [],
            errors: {},
            onReadingTimeChange,
            onDestinationChange: vi.fn()
        };
        const { rerender } = render(<DetailsSection {...input} />);
        expect(
            screen.getByText(
                'Edit the minutes, or clear this field to reset the saved reading time.'
            )
        ).toBeVisible();
        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
        expect(onReadingTimeChange).toHaveBeenCalledWith(null);
        const cleared = { ...data, readingTimeMinutes: null };
        expect(buildPostPatchPayload({ baseline: data, current: cleared })).toEqual({
            readingTimeMinutes: null
        });
        rerender(
            <DetailsSection
                {...input}
                data={cleared}
            />
        );
        expect(
            screen.getByText('No reading time is set. Enter the number of minutes to set one.')
        ).toBeVisible();
    });
});
