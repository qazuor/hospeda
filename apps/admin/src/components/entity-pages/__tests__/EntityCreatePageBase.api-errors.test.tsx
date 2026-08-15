/**
 * @file EntityCreatePageBase.api-errors.test.tsx
 * @description Regression suite for H-27 and H-28 (smoke agosto 2026), asserted
 * on the DOM the editor actually reads — not on the map an intermediate helper
 * returns.
 *
 * - H-27: every API validation error rendered as `[MISSING: zodError.…]`.
 * - H-28: an error on a field with no error slot rendered as NOTHING, so the
 *   Create button looked inert.
 *
 * Both halves are exercised in one submit, because that is how production
 * produced them: a single 400 whose details cover a field that CAN render its
 * own error and a field that cannot. `@repo/i18n` is deliberately NOT mocked —
 * a stub `t` is precisely what let H-27 live through two green suites.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * jsdom ships no IntersectionObserver, and the sticky `EntityPageHeader`
 * builds one on mount. Without this the whole page renders as the error
 * boundary — which silently satisfies any "the summary is absent" assertion.
 */
beforeAll(() => {
    if (!('IntersectionObserver' in globalThis)) {
        class NoopIntersectionObserver {
            observe() {}
            unobserve() {}
            disconnect() {}
            takeRecords() {
                return [];
            }
        }
        Object.defineProperty(globalThis, 'IntersectionObserver', {
            writable: true,
            value: NoopIntersectionObserver
        });
    }
});

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: () => undefined })
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => []
}));

vi.mock('@/features/billing/use-my-entitlements', () => ({
    useMyEntitlements: () => ({ has: () => true, isLoading: false })
}));

import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { EntityCreatePageBase } from '@/components/entity-pages/EntityCreatePageBase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * One section with a single text field. `authorId` is deliberately absent:
 * it is the field the API rejects that has nowhere to render its error — the
 * exact shape of H-28 (a TipTap body and an author select in production).
 */
const basicSection: SectionConfig = {
    id: 'basic-info',
    title: 'Básico',
    layout: LayoutTypeEnum.GRID,
    modes: ['create', 'edit'],
    fields: [
        {
            id: 'title',
            type: FieldTypeEnum.TEXT,
            label: 'Título',
            modes: ['create', 'edit']
        }
    ]
};

/** The 400 body the API returns for an empty post, verbatim in shape. */
const apiValidationError = {
    body: {
        success: false,
        error: {
            code: 'VALIDATION_ERROR',
            messageKey: 'validationError.validation.failed',
            zodMessage: 'Validation failed',
            userFriendlyMessage: 'Please fix the 2 validation errors in 2 fields',
            details: [
                {
                    field: 'title',
                    messageKey: 'zodError.post.title.required',
                    code: 'TOO_SMALL',
                    zodMessage: 'zodError.post.title.required',
                    userFriendlyMessage: 'Title is required'
                },
                {
                    field: 'authorId',
                    messageKey: 'validationError.field.invalidType',
                    code: 'INVALID_TYPE',
                    zodMessage: 'Invalid input: expected string, received undefined',
                    userFriendlyMessage: 'Author id is required'
                }
            ],
            summary: { totalErrors: 2, fieldCount: 2 }
        }
    }
};

function renderCreatePage() {
    const rejectingMutation = {
        mutateAsync: vi
            .fn()
            .mockRejectedValue(
                Object.assign(new Error('Request failed with status 400'), apiValidationError)
            ),
        isPending: false
    };

    render(
        <EntityCreatePageBase
            config={{
                entityType: 'post',
                title: 'Nuevo post',
                description: 'Crear un post',
                entityName: 'post',
                entityNamePlural: 'posts',
                basePath: '/posts',
                successToastTitle: 'ok',
                successToastMessage: 'ok',
                errorToastTitle: 'error',
                errorMessage: 'error',
                submitLabel: 'Crear',
                savingLabel: 'Creando…'
            }}
            createConsolidatedConfig={() => ({ sections: [basicSection] })}
            createMutation={rejectingMutation}
            onNavigate={() => undefined}
        />
    );

    return { rejectingMutation };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityCreatePageBase — API validation errors on screen', () => {
    it('shows the real localized message, never the [MISSING: …] sentinel (H-27)', async () => {
        // Arrange
        renderCreatePage();

        // Act — the most natural path there is: press Create on an empty form.
        await userEvent.click(screen.getByRole('button', { name: 'Crear entidad' }));

        // Assert — the string shipped in es/validation.json for
        // `validation.post.title.required`, resolved from the `zodError.*` key.
        await waitFor(() => {
            expect(screen.getAllByText(/El título es obligatorio/).length).toBeGreaterThan(0);
        });
        expect(document.body.textContent ?? '').not.toContain('[MISSING:');
        expect(document.body.textContent ?? '').not.toContain('zodError.');
    });

    it('shows an error whose field has no error slot in the form (H-28)', async () => {
        // Arrange — `authorId` is not one of the rendered fields.
        renderCreatePage();

        // Act
        await userEvent.click(screen.getByRole('button', { name: 'Crear entidad' }));

        // Assert — the message must land somewhere. Silence is what made the
        // Create button look broken in production.
        await waitFor(() => {
            expect(screen.getByTestId('form-error-summary')).toBeInTheDocument();
        });
        const summary = screen.getByTestId('form-error-summary');
        expect(summary.textContent ?? '').toContain('authorId');
        expect(summary.textContent ?? '').toContain('Tipo de dato inválido');
    });

    it('keeps the summary out of the DOM while the form has no errors', () => {
        // Arrange + Act
        renderCreatePage();

        // Assert — the page really rendered (an error boundary would satisfy
        // the absence check on its own), and costs nothing on the happy path.
        expect(screen.getByRole('button', { name: 'Crear entidad' })).toBeInTheDocument();
        expect(screen.queryByTestId('form-error-summary')).toBeNull();
    });
});
