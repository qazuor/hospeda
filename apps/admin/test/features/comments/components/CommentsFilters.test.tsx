/**
 * @file CommentsFilters.test.tsx
 * @description Tests for the CommentsFilters component (SPEC-165 T-017).
 *
 * Verifies:
 * - Renders the entityType, moderationState, search, and includeDeleted controls
 * - Changing entityType calls onChange with updated value
 * - Changing moderationState calls onChange with updated value
 * - Typing in search calls onChange with updated value
 * - Toggling includeDeleted calls onChange with updated value
 */

import type { CommentsFiltersValue } from '@/routes/_authed/comments/-components/CommentsFilters';
import { CommentsFilters } from '@/routes/_authed/comments/-components/CommentsFilters';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const EMPTY_FILTERS: CommentsFiltersValue = {
    entityType: '',
    moderationState: '',
    search: '',
    includeDeleted: false
};

describe('CommentsFilters', () => {
    it('renders all filter controls', () => {
        render(
            <CommentsFilters
                value={EMPTY_FILTERS}
                onChange={vi.fn()}
            />
        );
        // useTranslations is mocked globally — labels render as their i18n key strings
        expect(screen.getByLabelText('comments.list.filters.entityType')).toBeInTheDocument();
        expect(screen.getByLabelText('comments.list.filters.moderationState')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/contenido, autor/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/incluir eliminados/i)).toBeInTheDocument();
    });

    it('calls onChange with updated entityType when POST is selected', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <CommentsFilters
                value={EMPTY_FILTERS}
                onChange={onChange}
            />
        );

        await user.selectOptions(screen.getByLabelText('comments.list.filters.entityType'), 'POST');

        expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, entityType: 'POST' });
    });

    it('calls onChange with updated entityType when EVENT is selected', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <CommentsFilters
                value={EMPTY_FILTERS}
                onChange={onChange}
            />
        );

        await user.selectOptions(
            screen.getByLabelText('comments.list.filters.entityType'),
            'EVENT'
        );

        expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, entityType: 'EVENT' });
    });

    it('calls onChange with updated moderationState when REJECTED is selected', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <CommentsFilters
                value={EMPTY_FILTERS}
                onChange={onChange}
            />
        );

        await user.selectOptions(
            screen.getByLabelText('comments.list.filters.moderationState'),
            'REJECTED'
        );

        expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, moderationState: 'REJECTED' });
    });

    it('calls onChange when typing in the search input', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <CommentsFilters
                value={EMPTY_FILTERS}
                onChange={onChange}
            />
        );

        const input = screen.getByPlaceholderText(/contenido, autor/i);
        await user.type(input, 'a');

        expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, search: 'a' });
    });

    it('calls onChange with includeDeleted=true when checkbox is toggled on', async () => {
        const onChange = vi.fn();
        render(
            <CommentsFilters
                value={EMPTY_FILTERS}
                onChange={onChange}
            />
        );

        const checkbox = screen.getByRole('checkbox');
        checkbox.click();

        expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, includeDeleted: true });
    });

    it('calls onChange with includeDeleted=false when checkbox is toggled off', async () => {
        const onChange = vi.fn();
        const valueWithDeleted: CommentsFiltersValue = { ...EMPTY_FILTERS, includeDeleted: true };
        render(
            <CommentsFilters
                value={valueWithDeleted}
                onChange={onChange}
            />
        );

        const checkbox = screen.getByRole('checkbox');
        checkbox.click();

        expect(onChange).toHaveBeenCalledWith({ ...valueWithDeleted, includeDeleted: false });
    });
});
