/** Shared publication controls retain permissions, dirty guards and action IDs. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    PublicationSection,
    type PublicationSectionProps
} from '@/components/account/editor/PublicationSection.client';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

function props(overrides: Partial<PublicationSectionProps> = {}): PublicationSectionProps {
    return {
        locale: 'en',
        labels: {
            sectionTitle: 'Publication',
            explainer: 'Publication state',
            publish: 'Publish',
            unpublish: 'Unpublish',
            publishedToast: 'Published',
            unpublishedToast: 'Unpublished',
            publishErrorToast: 'Failed',
            blockedByUnsaved: 'Save first',
            delete: 'Delete',
            deleteConfirm: 'Delete this?',
            deleteYes: 'Confirm delete',
            deleteNo: 'Cancel',
            deleteErrorToast: 'Failed'
        },
        onSetPublishState: vi.fn().mockResolvedValue({ ok: true }),
        onApprove: vi.fn().mockResolvedValue({ ok: true }),
        onDelete: vi.fn(),
        listHref: '/en/account/',
        visibility: 'PUBLIC',
        moderationState: 'PENDING',
        lifecycleState: 'DRAFT',
        canPublish: true,
        canDelete: true,
        hasUnsavedChanges: false,
        onVisibilityChange: vi.fn(),
        onModerationStateChange: vi.fn(),
        ...overrides
    };
}

describe('PublicationSection', () => {
    it('uses kit action controls and preserves approve/delete IDs', async () => {
        const input = props();
        render(<PublicationSection {...input} />);
        const publish = screen.getByTestId('content-publish-toggle');
        expect(publish.className).toContain('primary');
        expect(screen.getByTestId('content-delete').className).toContain('danger');
        fireEvent.click(publish);
        await waitFor(() => expect(input.onApprove).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByTestId('content-delete'));
        expect(screen.getByTestId('content-delete-confirm').className).toContain('danger');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(input.onDelete).not.toHaveBeenCalled();
    });

    it('blocks publication while dirty and hides unavailable permissions', () => {
        const { rerender } = render(<PublicationSection {...props({ hasUnsavedChanges: true })} />);
        expect(screen.getByTestId('content-publish-toggle')).toBeDisabled();
        expect(screen.getByText('Save first')).toBeVisible();
        rerender(<PublicationSection {...props({ canPublish: false, canDelete: false })} />);
        expect(screen.queryByTestId('content-publish-toggle')).toBeNull();
        expect(screen.queryByTestId('content-delete')).toBeNull();
    });
});
