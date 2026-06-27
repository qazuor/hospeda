import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Local mocks — EntityEditContent pulls toast, env, translations and the
// section pulls entitlements / its own translations. Stub them so the test
// focuses on the EDIT accordion -> collapsed section -> input binding.
// ---------------------------------------------------------------------------

vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

vi.mock('@/features/billing/use-my-entitlements', () => ({
    useMyEntitlements: () => ({ has: () => true, isLoading: false })
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: () => undefined })
}));

vi.mock('@/env', () => ({
    env: { VITE_DEBUG_LAZY_SECTIONS: false }
}));

import { EntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import type { EntityFormContextValue } from '@/components/entity-form/context/EntityFormContext';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntityFormProvider } from '@/components/entity-form/providers/EntityFormProvider';
import type { EntityConfig } from '@/components/entity-form/types/entity-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';

// ---------------------------------------------------------------------------
// Fixtures — faithful to the real post edit config: an `ai-generate`
// customRender section (index 0 → open) followed by a `basic-info` section
// (collapsed). The AI panel applies a draft via setFieldValue while
// `basic-info` is collapsed.
// ---------------------------------------------------------------------------

/**
 * Mini AI panel hosted in the (open) ai-generate section. Applies a draft to
 * the parent form's `title` exactly like AiPostGeneratePanel.
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

const aiSection: SectionConfig = {
    id: 'ai-generate',
    title: 'AI',
    layout: LayoutTypeEnum.GRID,
    fields: [],
    defaultCollapsed: true,
    customRender: () => <MiniAiPanel />
};

const basicSection: SectionConfig = {
    id: 'basic-info',
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

const config: EntityConfig = {
    id: 'post',
    entityType: 'post',
    sections: [aiSection, basicSection],
    viewSections: [],
    editSections: [aiSection, basicSection],
    routes: {
        base: '/posts',
        view: '/posts/$id',
        edit: '/posts/$id/edit',
        sections: {},
        editSections: {}
    },
    permissions: { view: [], edit: [], create: [], delete: [] }
};

function renderEdit(initialValues: Record<string, unknown> = {}) {
    return render(
        <EntityFormProvider
            config={config}
            initialValues={initialValues}
            userPermissions={[]}
        >
            <EntityEditContent entityType="post" />
        </EntityFormProvider>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityEditContent collapsed-section apply (SPEC-223 edit-mode regression guard)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reflects an external setFieldValue applied while basic-info is collapsed, once expanded', () => {
        // Arrange — `ai-generate` (index 0) is open; `basic-info` collapsed, so
        // its title input is NOT mounted yet.
        renderEdit({ title: 'ORIGINAL' });
        expect(screen.queryByRole('textbox')).toBeNull();

        // Act 1 — AI panel applies a draft while basic-info is collapsed.
        act(() => {
            fireEvent.click(screen.getByTestId('external-apply'));
        });

        // Act 2 — expand basic-info, mounting its title input.
        act(() => {
            fireEvent.click(screen.getByTestId('accordion-header-basic-info'));
        });

        // Assert — the now-mounted input must show the applied draft, NOT the
        // stale original value.
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('EXTERNAL');
    });
});
