import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Local mocks
// ---------------------------------------------------------------------------
// EntityFormProvider pulls translations from `@repo/i18n`; EntityFormSection
// pulls from `@/hooks/use-translations` and entitlements from
// `use-my-entitlements`. Stub all three so the test focuses on the
// provider -> context.values -> section -> input binding chain.

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
    SectionAccordion,
    SectionAccordionItem
} from '@/components/entity-form/accordion/SectionAccordion';
import {
    EntityFormContext,
    type EntityFormContextValue
} from '@/components/entity-form/context/EntityFormContext';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntityFormProvider } from '@/components/entity-form/providers/EntityFormProvider';
import type { EntityConfig } from '@/components/entity-form/types/entity-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal single-TEXT-field section used by both the provider config and the
 * rendered EntityFormSection. The field id `title` mirrors the real post form.
 */
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

/**
 * Minimal EntityConfig with a single section that the provider needs.
 */
const config: EntityConfig = {
    id: 'post',
    entityType: 'post',
    sections: [titleSection],
    viewSections: [],
    editSections: [titleSection],
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
 * Bridges the EntityFormProvider context into the real EntityFormSection,
 * mirroring exactly how EntityEditContent wires `values` / `setFieldValue`.
 * Also exposes two buttons:
 *  - "external-apply": calls `setFieldValue('title', 'EXTERNAL')` the way the
 *    AI panel does (programmatic, NOT via the input's onChange).
 */
/**
 * Mini AI panel: reads the form context exactly like AiPostGeneratePanel and
 * applies a draft via `setFieldValue` on a button click.
 */
function MiniAiPanel() {
    const ctx = React.useContext(EntityFormContext) as EntityFormContextValue;
    return (
        <button
            type="button"
            data-testid="external-apply"
            onClick={() => ctx.setFieldValue('title', 'EXTERNAL')}
        >
            apply
        </button>
    );
}

/**
 * customRender section that hosts the AI panel — mirrors the real
 * `ai-generate` section config (empty fields, customRender returns the panel).
 */
const aiSection: SectionConfig = {
    id: 'ai',
    title: 'AI',
    layout: LayoutTypeEnum.GRID,
    fields: [],
    customRender: () => <MiniAiPanel />
};

/**
 * Faithful copy of EntityEditContent's wiring: BOTH sections are rendered as
 * memoized `EntityFormSection` inside `SectionAccordionItem`s. The AI panel is
 * produced by the ai section's `customRender` (the SPEC-223 code path) and
 * calls `setFieldValue` programmatically, exactly like the real panel.
 */
function FormHarness() {
    const ctx = React.useContext(EntityFormContext) as EntityFormContextValue;

    return (
        <SectionAccordion defaultOpenIds={['basic', 'ai']}>
            <SectionAccordionItem
                id="basic"
                title="Basic"
            >
                <EntityFormSection
                    config={titleSection}
                    values={ctx.values}
                    errors={ctx.errors}
                    onFieldChange={ctx.setFieldValue}
                    onFieldBlur={() => undefined}
                    userPermissions={[]}
                />
            </SectionAccordionItem>
            <SectionAccordionItem
                id="ai"
                title="AI"
            >
                <EntityFormSection
                    config={aiSection}
                    values={ctx.values}
                    errors={ctx.errors}
                    onFieldChange={ctx.setFieldValue}
                    onFieldBlur={() => undefined}
                    userPermissions={[]}
                />
            </SectionAccordionItem>
        </SectionAccordion>
    );
}

function renderForm(initialValues: Record<string, unknown> = {}) {
    return render(
        <EntityFormProvider
            config={config}
            initialValues={initialValues}
            userPermissions={[]}
        >
            <FormHarness />
        </EntityFormProvider>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityFormProvider value reactivity (SPEC-223 AI apply bug)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reflects an EXTERNAL setFieldValue in the controlled input', () => {
        // Arrange
        renderForm({ title: '' });
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');

        // Act — simulate the AI panel calling setFieldValue programmatically.
        fireEvent.click(screen.getByTestId('external-apply'));

        // Assert — the input must show the new value.
        expect(input.value).toBe('EXTERNAL');
    });

    it('tracks the TanStack store: a raw form.setFieldValue (no dirty side-effect) still reflects', () => {
        // Arrange — this asserts the provider's `values` are REACTIVE to the
        // store, not an accidental by-product of setDirtyFields. We grab the
        // raw form instance from context and mutate it directly, bypassing the
        // provider's setFieldValue (which also pokes setDirtyFields and thus
        // masks the missing store subscription).
        // The public `ReactFormApi` type does not surface `setFieldValue` in this
        // version, though the runtime FormApi always has it. Capture a narrow
        // structural shape we can call directly in the test.
        type RawSetter = { setFieldValue: (name: string, value: unknown) => void };
        const formRef: { current: RawSetter | null } = { current: null };

        function GrabForm() {
            const ctx = React.useContext(EntityFormContext) as EntityFormContextValue;
            formRef.current = ctx.form as unknown as RawSetter;
            return null;
        }

        render(
            <EntityFormProvider
                config={config}
                initialValues={{ title: '' }}
                userPermissions={[]}
            >
                <GrabForm />
                <FormHarness />
            </EntityFormProvider>
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');

        // Act — raw store write, no provider state poke.
        act(() => {
            formRef.current?.setFieldValue('title', 'RAW');
        });

        // Assert — the controlled input must reflect the store value.
        expect(input.value).toBe('RAW');
    });

    it('keeps manual typing working AND a subsequent external setFieldValue reflects', () => {
        // Arrange
        renderForm({ title: '' });
        const input = screen.getByRole('textbox') as HTMLInputElement;

        // Act — manual typing.
        fireEvent.change(input, { target: { value: 'typed' } });
        // Assert — typing updates the input.
        expect(input.value).toBe('typed');

        // Act — external programmatic write afterwards.
        fireEvent.click(screen.getByTestId('external-apply'));
        // Assert — external write also reflects.
        expect(input.value).toBe('EXTERNAL');
    });
});
