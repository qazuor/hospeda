// @vitest-environment jsdom
/**
 * Tests for UserTagModerationTable component.
 *
 * Covers:
 * - Owner display name and role visible in rows
 * - Delete action button is present when canDeleteAny is true
 * - NO edit or rename action present (D-012 explicit assertion)
 * - Delete action button is hidden when canDeleteAny is false
 * - Empty state when no tags are provided
 * - onDeleteClick is called with the correct tag when delete is clicked
 *
 * References: D-012, AC-008-01, AC-008-02
 */

import type { UserTagWithOwner } from '@/hooks/use-user-tag-moderation';
import { LifecycleStatusEnum, TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserTagModerationTable } from '../UserTagModerationTable';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockTag1: UserTagWithOwner = {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Mi Favorita',
    type: TagTypeEnum.USER,
    color: TagColorEnum.BLUE,
    icon: null,
    description: null,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ownerId: '00000000-0000-0000-0000-000000000001',
    ownerDisplayName: 'Ana García',
    ownerEmail: 'ana@example.com',
    ownerRole: 'USER',
    usageCount: 3,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: null,
    updatedById: null
};

const mockTag2: UserTagWithOwner = {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Para visitar',
    type: TagTypeEnum.USER,
    color: TagColorEnum.GREEN,
    icon: null,
    description: null,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ownerId: '00000000-0000-0000-0000-000000000002',
    ownerDisplayName: 'Carlos Rodríguez',
    ownerEmail: 'carlos@example.com',
    ownerRole: 'USER',
    usageCount: 0,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    createdById: null,
    updatedById: null
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserTagModerationTable', () => {
    /**
     * AC-008-01: Owner display name and role are visible.
     */
    it('displays the owner display name for each tag row', () => {
        render(
            <UserTagModerationTable
                tags={[mockTag1, mockTag2]}
                onDeleteClick={vi.fn()}
                isDeleting={false}
                canDeleteAny={true}
            />
        );

        expect(screen.getByText('Ana García')).toBeInTheDocument();
        expect(screen.getByText('Carlos Rodríguez')).toBeInTheDocument();
    });

    /**
     * AC-008-01: Owner role is visible as secondary info.
     */
    it('displays the owner role as secondary info under display name', () => {
        render(
            <UserTagModerationTable
                tags={[mockTag1]}
                onDeleteClick={vi.fn()}
                isDeleting={false}
                canDeleteAny={true}
            />
        );

        expect(screen.getByText('USER')).toBeInTheDocument();
    });

    /**
     * Tag name visible in each row.
     */
    it('shows the tag name in the table row', () => {
        render(
            <UserTagModerationTable
                tags={[mockTag1]}
                onDeleteClick={vi.fn()}
                isDeleting={false}
                canDeleteAny={true}
            />
        );

        expect(screen.getByText('Mi Favorita')).toBeInTheDocument();
    });

    /**
     * D-012 CRITICAL: NO edit/rename action present.
     * `TAG_USER_UPDATE_ANY` is intentionally excluded — admin CANNOT rename user tags.
     */
    it('does NOT render an edit or rename action button for USER tags (D-012)', () => {
        render(
            <UserTagModerationTable
                tags={[mockTag1, mockTag2]}
                onDeleteClick={vi.fn()}
                isDeleting={false}
                canDeleteAny={true}
            />
        );

        // No "Editar" text anywhere in the table
        expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /renombrar/i })).not.toBeInTheDocument();
    });

    /**
     * AC-008-02: Delete action button IS present when canDeleteAny is true.
     */
    it('shows the delete action button for each row when canDeleteAny is true', () => {
        render(
            <UserTagModerationTable
                tags={[mockTag1, mockTag2]}
                onDeleteClick={vi.fn()}
                isDeleting={false}
                canDeleteAny={true}
            />
        );

        expect(
            screen.getByRole('button', { name: /eliminar etiqueta "Mi Favorita"/i })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /eliminar etiqueta "Para visitar"/i })
        ).toBeInTheDocument();
    });

    /**
     * Delete action column hidden when canDeleteAny is false.
     */
    it('hides the delete action column when canDeleteAny is false', () => {
        render(
            <UserTagModerationTable
                tags={[mockTag1]}
                onDeleteClick={vi.fn()}
                isDeleting={false}
                canDeleteAny={false}
            />
        );

        expect(
            screen.queryByRole('button', { name: /eliminar etiqueta/i })
        ).not.toBeInTheDocument();
    });

    /**
     * onDeleteClick called with the correct tag object when delete is clicked.
     */
    it('calls onDeleteClick with the correct tag when the delete button is clicked', async () => {
        const onDeleteClick = vi.fn();
        const user = userEvent.setup();

        render(
            <UserTagModerationTable
                tags={[mockTag1]}
                onDeleteClick={onDeleteClick}
                isDeleting={false}
                canDeleteAny={true}
            />
        );

        await user.click(screen.getByRole('button', { name: /eliminar etiqueta "Mi Favorita"/i }));

        expect(onDeleteClick).toHaveBeenCalledWith(mockTag1);
    });

    /**
     * Renders empty state when tag list is empty.
     */
    it('renders an empty state message when tags array is empty', () => {
        render(
            <UserTagModerationTable
                tags={[]}
                onDeleteClick={vi.fn()}
                isDeleting={false}
                canDeleteAny={true}
            />
        );

        expect(screen.getByText(/no hay etiquetas de usuario para moderar/i)).toBeInTheDocument();
    });

    /**
     * Delete button is disabled while a deletion is in progress for that specific row.
     */
    it('disables the delete button for the row being deleted', () => {
        render(
            <UserTagModerationTable
                tags={[mockTag1]}
                onDeleteClick={vi.fn()}
                isDeleting={true}
                deletingTagId={mockTag1.id}
                canDeleteAny={true}
            />
        );

        expect(screen.getByTestId(`delete-action-${mockTag1.id}`)).toBeDisabled();
    });
});
