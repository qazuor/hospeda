/**
 * EntityPageBase save path sends only what changed (HOS-1493).
 *
 * On somebody else's listing the API accepts content fields only (action 15),
 * so an unchanged status/visibility field riding along made every support edit
 * fail with 403. These tests drive the real EntityPageBase + EntityEditContent
 * and assert the payload handed to the update mutation.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addToast = vi.fn();

vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({ t: (key: string) => key, tPlural: (key: string) => key })
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key, tPlural: (key: string) => key })
}));

vi.mock('@/features/billing/use-effective-set', () => ({
    useEffectiveSet: () => ({ has: () => true, isLoading: false })
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast })
}));

vi.mock('@/env', () => ({
    env: { VITE_DEBUG_LAZY_SECTIONS: false }
}));

import type { EntityFormContextValue } from '@/components/entity-form/context/EntityFormContext';
import { EntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { ENTITY_EDIT_FORM_ID } from '@/components/entity-header/EntityPageHeader';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { ApiError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures — one section mixing content fields (name, description, the
// nested location group) with non-content ones (visibility, lifecycleState),
// like the real listing edit sections.
// ---------------------------------------------------------------------------

/** Writes into the live form exactly like an input would. */
function Editor() {
    const ctx = React.useContext(EntityFormContext) as EntityFormContextValue;
    return (
        <>
            <button
                type="button"
                data-testid="edit-description"
                onClick={() => ctx.setFieldValue('description', 'New description')}
            >
                description
            </button>
            <button
                type="button"
                data-testid="retype-location-same"
                onClick={() => ctx.setFieldValue('location.city', 'Colón')}
            >
                location same
            </button>
            <button
                type="button"
                data-testid="edit-location-city"
                onClick={() => ctx.setFieldValue('location.city', 'Paraná')}
            >
                location city
            </button>
        </>
    );
}

const field = (id: string) => ({ id, type: FieldTypeEnum.TEXT, label: id });

const mixedSection: SectionConfig = {
    id: 'basic-info',
    title: 'Basic',
    layout: LayoutTypeEnum.GRID,
    fields: [
        field('name'),
        field('description'),
        field('visibility'),
        field('lifecycleState'),
        field('location.city'),
        field('location.state')
    ],
    customRender: () => <Editor />
};

const entity = {
    id: 'acc-1',
    name: 'Casa del Río',
    description: 'Old description',
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    location: { city: 'Colón', state: 'Entre Ríos' }
};

function renderPage(mutateAsync: (values: Record<string, unknown>) => Promise<unknown>) {
    const entityData = {
        mode: 'edit' as const,
        setMode: vi.fn(),
        switchToView: vi.fn(),
        switchToEdit: vi.fn(),
        entity,
        isLoading: false,
        error: null,
        entityConfig: { viewSections: [], editSections: [mixedSection] },
        userPermissions: [],
        canView: true,
        canEdit: true,
        goToList: vi.fn(),
        goToView: vi.fn(),
        goToEdit: vi.fn(),
        updateMutation: { mutateAsync, isLoading: false }
    };
    render(
        <EntityPageBase
            entityType="accommodation"
            entityId="acc-1"
            initialMode="edit"
            entityData={entityData}
        >
            <EntityEditContent entityType="accommodation" />
        </EntityPageBase>
    );
    return entityData;
}

const submit = async () => {
    const form = document.getElementById(ENTITY_EDIT_FORM_ID) as HTMLFormElement;
    await act(async () => {
        fireEvent.submit(form);
    });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityPageBase save sends only the changed fields (HOS-1493)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends only the edited content field, never the unchanged non-content ones', async () => {
        // Arrange
        const mutateAsync = vi.fn().mockResolvedValue({});
        renderPage(mutateAsync);

        // Act
        act(() => {
            fireEvent.click(screen.getByTestId('edit-description'));
        });
        await submit();

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toStrictEqual({
            description: 'New description'
        });
    });

    it('does not call the mutation when nothing changed and says there is nothing to save', async () => {
        // Arrange
        const mutateAsync = vi.fn().mockResolvedValue({});
        const entityData = renderPage(mutateAsync);

        // Act
        await submit();

        // Assert
        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'error.form.no-changes', variant: 'info' })
            )
        );
        expect(mutateAsync).not.toHaveBeenCalled();
        expect(entityData.goToView).not.toHaveBeenCalled();
    });

    it('leaves out a nested object whose value did not change, even when re-written', async () => {
        // Arrange
        const mutateAsync = vi.fn().mockResolvedValue({});
        renderPage(mutateAsync);

        // Act — the location is re-written with the same value (new reference).
        act(() => {
            fireEvent.click(screen.getByTestId('retype-location-same'));
            fireEvent.click(screen.getByTestId('edit-description'));
        });
        await submit();

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toStrictEqual({
            description: 'New description'
        });
    });

    it('sends the whole nested group when one of its fields changed', async () => {
        // Arrange
        const mutateAsync = vi.fn().mockResolvedValue({});
        renderPage(mutateAsync);

        // Act
        act(() => {
            fireEvent.click(screen.getByTestId('edit-location-city'));
        });
        await submit();

        // Assert — the server receives a complete location, not a fragment.
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toStrictEqual({
            location: { city: 'Paraná', state: 'Entre Ríos' }
        });
    });

    it('shows the specific forbidden message on a 403, not the API message', async () => {
        // Arrange
        const mutateAsync = vi.fn().mockRejectedValue(
            new ApiError('Action 15 edits content only; not allowed: visibility', {
                status: 403,
                code: 'FORBIDDEN'
            })
        );
        const entityData = renderPage(mutateAsync);

        // Act
        act(() => {
            fireEvent.click(screen.getByTestId('edit-description'));
        });
        await submit();

        // Assert
        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith({
                title: 'error.form.save-failed',
                message: 'error.form.save-forbidden',
                variant: 'error'
            })
        );
        expect(entityData.goToView).not.toHaveBeenCalled();
    });
});
