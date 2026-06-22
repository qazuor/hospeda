import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Local mocks
// ---------------------------------------------------------------------------
// Same stubs as the reactivity / create-apply tests. We focus on the
// EDIT-mode collapsed-section binding: an external `setFieldValue` written
// while a section's accordion body is UNMOUNTED (collapsed) must be visible
// once the section is expanded.

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

/** Single TEXT field section; `title` mirrors the real post form. */
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

/** customRender section hosting the mini AI panel (always open). */
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
 * Mini AI panel: applies a draft via `setFieldValue` exactly like the real
 * AiPostGeneratePanel. Lives in the always-open AI section so it stays
 * mounted while the `basic` section is collapsed.
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
 * Faithful copy of `EntityEditContent`'s accordion wiring: the `basic`
 * section starts COLLAPSED (defaultOpenIds excludes it). The AI section is
 * open so its panel can fire `setFieldValue` while `basic` is unmounted.
 */
function EditAccordionHarness() {
    const ctx = React.useContext(EntityFormContext) as EntityFormContextValue;

    return (
        <SectionAccordion defaultOpenIds={['ai']}>
            <SectionAccordionItem
                id="basic"
                title="Basic"
                defaultCollapsed={true}
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
            <EditAccordionHarness />
        </EntityFormProvider>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityFormProvider collapsed-section apply (SPEC-223 edit-mode regression guard)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reflects an external setFieldValue applied while the section is collapsed, once expanded', () => {
        // Arrange — original value loaded; `basic` section starts collapsed so
        // its input is NOT in the DOM yet.
        renderForm({ title: 'ORIGINAL' });
        expect(screen.queryByRole('textbox')).toBeNull();

        // Act 1 — AI panel applies a draft while `basic` is collapsed.
        act(() => {
            fireEvent.click(screen.getByTestId('external-apply'));
        });

        // Act 2 — expand the `basic` section, mounting its input.
        act(() => {
            fireEvent.click(screen.getByTestId('accordion-header-basic'));
        });

        // Assert — the now-mounted input must show the applied draft, NOT the
        // stale original value.
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('EXTERNAL');
    });
});
