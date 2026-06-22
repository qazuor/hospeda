import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Local mocks
// ---------------------------------------------------------------------------
// Same stubs as the reactivity test: translations from `@repo/i18n` (provider)
// and `@/hooks/use-translations` (section), plus entitlements. We focus on the
// CREATE-mode binding chain: local `values` state -> section -> input AND the
// provider's `onFieldChange` callback routing a programmatic `setFieldValue`
// back into that local state.

vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

vi.mock('@/features/billing/use-my-entitlements', () => ({
    useMyEntitlements: () => ({ has: () => true, isLoading: false })
}));

import { EntityFormSection } from '@/components/entity-form/EntityFormSection';
import {
    EntityFormContext,
    type EntityFormContextValue
} from '@/components/entity-form/context/EntityFormContext';
import {
    FieldTypeEnum,
    FormModeEnum,
    LayoutTypeEnum
} from '@/components/entity-form/enums/form-config.enums';
import { EntityFormProvider } from '@/components/entity-form/providers/EntityFormProvider';
import type { EntityConfig } from '@/components/entity-form/types/entity-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Single TEXT field section, id `title` mirrors the real post form. */
const titleSection: SectionConfig = {
    id: 'basic',
    title: 'Basic',
    layout: LayoutTypeEnum.GRID,
    fields: [
        {
            id: 'title',
            type: FieldTypeEnum.TEXT,
            label: 'Title'
        }
    ]
};

/** customRender section hosting the mini AI panel (SPEC-223 code path). */
const aiSection: SectionConfig = {
    id: 'ai',
    title: 'AI',
    layout: LayoutTypeEnum.GRID,
    fields: [],
    customRender: () => <MiniAiPanel />
};

const config: EntityConfig = {
    id: 'post',
    entityType: 'post',
    sections: [titleSection, aiSection],
    viewSections: [],
    editSections: [titleSection, aiSection],
    routes: {
        base: '/posts',
        view: '/posts/$id',
        edit: '/posts/$id/edit',
        sections: {},
        editSections: {}
    },
    permissions: { view: [], edit: [], create: [], delete: [] }
};

/**
 * Mini AI panel: reads the form context exactly like AiPostGeneratePanel and
 * applies a draft via `formContext.setFieldValue` on click. This is the
 * programmatic write path that must reach the create page's local `values`.
 */
function MiniAiPanel() {
    const ctx = React.useContext(EntityFormContext) as EntityFormContextValue;
    return (
        <button
            type="button"
            data-testid="external-apply"
            onClick={() => ctx.setFieldValue('title', 'AI_TITLE')}
        >
            apply
        </button>
    );
}

/**
 * Faithful copy of `EntityCreatePageBase`'s CREATE wiring:
 * - local `values` state is the source of truth (NOT the provider store);
 * - `handleFieldChange` does `setValues`;
 * - sections receive `values={localValues}` + `onFieldChange={handleFieldChange}`
 *   (so typing goes to local state, never the provider's setFieldValue);
 * - the provider is wired with `onFieldChange={handleFieldChange}` so a
 *   programmatic `setFieldValue` (AI panel) is routed back into local state.
 * `submittedRef` captures what create would submit (the local values).
 */
function CreateHarness({
    submittedRef
}: {
    submittedRef: { current: Record<string, unknown> | null };
}) {
    const [values, setValues] = React.useState<Record<string, unknown>>({ title: '' });

    const handleFieldChange = (fieldId: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [fieldId]: value }));
    };

    // Mirror create's submit: local `values` are the payload source of truth.
    submittedRef.current = values;

    return (
        <EntityFormProvider
            config={config}
            mode={FormModeEnum.CREATE}
            initialValues={{}}
            userPermissions={[]}
            onFieldChange={handleFieldChange}
        >
            <EntityFormSection
                config={titleSection}
                values={values}
                errors={{}}
                onFieldChange={handleFieldChange}
                onFieldBlur={() => undefined}
                userPermissions={[]}
            />
            <EntityFormSection
                config={aiSection}
                values={values}
                errors={{}}
                onFieldChange={handleFieldChange}
                onFieldBlur={() => undefined}
                userPermissions={[]}
            />
        </EntityFormProvider>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityCreatePageBase AI-apply wiring (SPEC-223 create-mode bug)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reflects a programmatic setFieldValue in the create-mode input AND would-be submit payload', () => {
        // Arrange
        const submittedRef: { current: Record<string, unknown> | null } = { current: null };
        render(<CreateHarness submittedRef={submittedRef} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');

        // Act — simulate the AI panel applying a draft via provider setFieldValue.
        fireEvent.click(screen.getByTestId('external-apply'));

        // Assert — the input shows the new value (local state was updated via
        // the provider's onFieldChange callback)...
        expect(input.value).toBe('AI_TITLE');
        // ...and the create-mode submit source (local values) carries it too.
        expect(submittedRef.current).toMatchObject({ title: 'AI_TITLE' });
    });

    it('keeps manual typing working without double-applying (single source of truth stays consistent)', () => {
        // Arrange
        const submittedRef: { current: Record<string, unknown> | null } = { current: null };
        render(<CreateHarness submittedRef={submittedRef} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;

        // Act — manual typing routes through the section's onFieldChange (local
        // handleFieldChange) directly, NOT the provider's setFieldValue.
        fireEvent.change(input, { target: { value: 'typed' } });

        // Assert — typing reflects exactly once in local state.
        expect(input.value).toBe('typed');
        expect(submittedRef.current).toMatchObject({ title: 'typed' });

        // Act — a subsequent programmatic apply overrides cleanly.
        fireEvent.click(screen.getByTestId('external-apply'));

        // Assert — programmatic write reflects, no stale/double value.
        expect(input.value).toBe('AI_TITLE');
        expect(submittedRef.current).toMatchObject({ title: 'AI_TITLE' });
    });
});
