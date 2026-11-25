/** Icon triggers preserve metadata expansion markers and keyboard focus recovery. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoMetadataEditor } from '@/components/host/editor/PhotoMetadataEditor.client';

describe('PhotoMetadataEditor icon trigger', () => {
    it('preserves names, expansion, row markers and focus after a successful save', async () => {
        const onSave = vi.fn().mockResolvedValue(true);
        const { container } = render(
            <PhotoMetadataEditor
                locale="en"
                item={{ id: 'image-1', alt: 'Garden' }}
                disabled={false}
                iconOnly
                compactLayout
                closeOnSuccessfulSave
                toggleAriaLabel="Edit garden details"
                closeAriaLabel="Close garden details"
                onSave={onSave}
            />
        );
        const trigger = screen.getByRole('button', { name: 'Edit garden details' });
        expect(trigger).not.toHaveTextContent('Edit text');
        fireEvent.click(trigger);
        expect(screen.getByRole('button', { name: 'Close garden details' })).toHaveAttribute(
            'aria-expanded',
            'true'
        );
        expect(container.querySelector('[data-photo-metadata-id="image-1"]')).toHaveAttribute(
            'data-tile-expanded',
            'true'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Edit garden details' })).toHaveFocus()
        );
        expect(onSave).toHaveBeenCalledOnce();
        expect(container.querySelector('[data-photo-metadata-id="image-1"]')).not.toHaveAttribute(
            'data-tile-expanded'
        );
    });
});
