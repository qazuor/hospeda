// @vitest-environment jsdom
/**
 * @file EntityFormSection.customRender.test.tsx
 * @description Integration regression test for the `customRender` branch in
 *   EntityFormSection (SPEC-223 BLOCKER-1).
 *
 * Prior to the fix, a section whose `fields` array is empty and that provides
 * `customRender` would render nothing — the section body renderer had NO
 * `customRender` branch (only EntityViewContent honoured it). This test
 * verifies that:
 *
 *   1. A section with `customRender` renders the custom component.
 *   2. A section WITHOUT `customRender` continues to work as before (no regression).
 *   3. The "no accessible fields" fallback is NOT shown for customRender sections.
 *
 * The test intentionally avoids billing/entitlement mocks because the
 * `customRender` branch fires BEFORE field iteration. We stub the heavy
 * hooks/providers so the component renders without a full app context.
 */

import { EntityFormSection } from '@/components/entity-form/EntityFormSection';
import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks for heavy hooks that EntityFormSection pulls in
// ---------------------------------------------------------------------------

// useMyEntitlements — always return has=true (no locks) so no premium block
vi.mock('@/features/billing/use-my-entitlements', () => ({
    useMyEntitlements: () => ({ has: () => true, isLoading: false })
}));

// LimitProgressIndicator + PremiumBlock are not exercised here; stub them out
vi.mock('@/features/billing/LimitProgressIndicator', () => ({
    LimitProgressIndicator: () => null
}));

vi.mock('@/features/billing/PremiumBlock', () => ({
    PremiumBlock: () => null
}));

// useTranslations — return key as value (standard in test/setup.tsx, but guard locally)
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Section with customRender and no fields (the ai-generate shape). */
function makeCustomRenderSection(id: string): SectionConfig {
    return {
        id,
        title: `Section ${id}`,
        layout: LayoutTypeEnum.GRID,
        modes: ['create', 'edit'],
        fields: [],
        customRender: () => <div data-testid={`custom-render-${id}`}>Custom Panel Content</div>
    };
}

/** Regular section with one text field (no customRender). */
function makeNormalSection(id: string): SectionConfig {
    return {
        id,
        title: `Normal ${id}`,
        layout: LayoutTypeEnum.GRID,
        modes: ['create', 'edit'],
        // A real field would require renderField internals; use an empty fields
        // array here (no customRender) to test the "no accessible fields"
        // fallback path separately.
        fields: []
    };
}

const baseProps = {
    values: {},
    errors: {},
    onFieldChange: vi.fn(),
    onFieldBlur: vi.fn(),
    userPermissions: [],
    disabled: false
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntityFormSection — customRender branch (SPEC-223 BLOCKER-1)', () => {
    /**
     * REGRESSION TEST: was broken before the fix.
     *
     * Before the fix: `renderSectionContent` had NO customRender check, so a
     * section with `fields:[]` would render an empty grid and then show the
     * "noAccessibleFields" fallback — the AiPostGeneratePanel never reached DOM.
     *
     * After the fix: the customRender function is called first and its output
     * replaces the field-grid entirely.
     */
    it('renders the customRender output when section.customRender is defined', () => {
        const section = makeCustomRenderSection('ai-generate');

        render(
            <EntityFormSection
                config={section}
                {...baseProps}
            />
        );

        // The component returned by customRender must be in the DOM.
        expect(screen.getByTestId('custom-render-ai-generate')).toBeInTheDocument();
        expect(screen.getByText('Custom Panel Content')).toBeInTheDocument();
    });

    it('does NOT show the "no accessible fields" message for customRender sections', () => {
        const section = makeCustomRenderSection('ai-generate');

        render(
            <EntityFormSection
                config={section}
                {...baseProps}
            />
        );

        // The i18n fallback key must NOT appear — customRender replaced the field-grid.
        expect(
            screen.queryByText('admin-common.entityForm.noAccessibleFields')
        ).not.toBeInTheDocument();
    });

    /**
     * NON-REGRESSION: sections without customRender must continue to render
     * the "noAccessibleFields" fallback when their fields array is empty (the
     * pre-existing behaviour for normal sections with no visible fields).
     */
    it('shows "no accessible fields" for a normal section with empty fields (no regression)', () => {
        const section = makeNormalSection('empty-normal');

        render(
            <EntityFormSection
                config={section}
                {...baseProps}
            />
        );

        expect(screen.getByText('admin-common.entityForm.noAccessibleFields')).toBeInTheDocument();
    });

    /**
     * Multiple customRender sections (edge case): each must render its own output.
     */
    it('renders each customRender section independently when multiple are mounted', () => {
        const sectionA = makeCustomRenderSection('panel-a');
        const sectionB = makeCustomRenderSection('panel-b');

        const { container } = render(
            <div>
                <EntityFormSection
                    config={sectionA}
                    {...baseProps}
                />
                <EntityFormSection
                    config={sectionB}
                    {...baseProps}
                />
            </div>
        );

        expect(
            container.querySelector('[data-testid="custom-render-panel-a"]')
        ).toBeInTheDocument();
        expect(
            container.querySelector('[data-testid="custom-render-panel-b"]')
        ).toBeInTheDocument();
    });
});
