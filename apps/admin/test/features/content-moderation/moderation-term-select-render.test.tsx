// @vitest-environment jsdom
/**
 * Render regression: the moderation-term selects must actually receive their
 * options through the property `EntityFormSection` reads (HOS-1068).
 *
 * The other guards for this bug are source greps — they read the `.tsx` and
 * brace-match for `typeConfig:`. That is enough to stop the original typo from
 * being retyped, and not enough for the failure it belongs to: if someone
 * refactors `EntityFormSection` and changes the key it reads, the selects go
 * empty again and every one of those guards stays green, because the text
 * `typeConfig:` is still sitting in the route. Declared is not read — which is
 * the entire subject of HOS-1068, so it deserves a test that exercises the path
 * instead of describing it.
 *
 * Reading the OPTIONS out of a Radix `SelectContent` means opening the popover,
 * which is unreliable under jsdom. So the assertion goes through the trigger
 * instead: `SelectField` resolves the current value against `options` and
 * renders the matching option's LABEL, falling back to the placeholder when it
 * finds nothing. A label on screen therefore proves the option list travelled
 * the whole way from the builder, through `typeConfig`, into the field — and
 * an empty list is exactly what the placeholder-and-"no options" state means.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityFormSection } from '@/components/entity-form/EntityFormSection';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import {
    buildModerationCategoryOptions,
    buildModerationTermKindOptions
} from '@/features/content-moderation/moderation-term-options';

vi.mock('@/features/billing/use-my-entitlements', () => ({
    useMyEntitlements: () => ({ has: () => true, isLoading: false })
}));
vi.mock('@/features/billing/LimitProgressIndicator', () => ({
    LimitProgressIndicator: () => null
}));
vi.mock('@/features/billing/PremiumBlock', () => ({ PremiumBlock: () => null }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

const t = (key: string): string => key;

const baseProps = {
    errors: {},
    onFieldChange: vi.fn(),
    onFieldBlur: vi.fn(),
    userPermissions: [],
    disabled: false
};

/**
 * Builds the section the way the route does — through the shared builders, so
 * this test checks the PRODUCER rather than re-declaring its output here and
 * checking a copy of itself.
 */
const buildSection = ({ withOptions = true }: { withOptions?: boolean } = {}): SectionConfig => {
    const { options: kindOptions } = buildModerationTermKindOptions({ t });
    const { options: categoryOptions } = buildModerationCategoryOptions({ t });

    return {
        id: 'basic-info',
        title: 'Basic info',
        layout: LayoutTypeEnum.GRID,
        modes: ['create', 'edit', 'view'],
        fields: [
            {
                id: 'kind',
                label: 'Tipo',
                type: FieldTypeEnum.SELECT,
                required: true,
                typeConfig: { options: withOptions ? kindOptions : [] }
            },
            {
                id: 'category',
                label: 'Categoría',
                type: FieldTypeEnum.SELECT,
                required: true,
                typeConfig: { options: withOptions ? categoryOptions : [] }
            }
        ]
    } satisfies SectionConfig;
};

describe('the moderation-term selects receive their options (HOS-1068)', () => {
    it('renders the label of the selected category, proving the list reached the field', () => {
        render(
            <EntityFormSection
                config={buildSection()}
                values={{ kind: 'word', category: 'hate' }}
                {...baseProps}
            />
        );

        // The identity translator makes the label the i18n key, so these are
        // the keys the builders declare for those two values.
        expect(
            screen.getByText('content-moderation.categories.hate'),
            'The Categoría trigger does not show the selected option. SelectField only renders a label it can find in `options`, so an empty list — the HOS-1068 symptom — shows the placeholder instead.'
        ).toBeInTheDocument();
        expect(screen.getByText('content-moderation.terms.kinds.word')).toBeInTheDocument();
    });

    it('resolves every offered category, not just the first', () => {
        const { options } = buildModerationCategoryOptions({ t });

        for (const { value, label } of options) {
            const { unmount } = render(
                <EntityFormSection
                    config={buildSection()}
                    values={{ kind: 'word', category: value }}
                    {...baseProps}
                />
            );

            expect(
                screen.getByText(label),
                `Category '${value}' is offered but its label does not render when selected.`
            ).toBeInTheDocument();
            unmount();
        }
    });

    /**
     * The discriminator. Without this, the assertions above could pass on a
     * component that renders the label from somewhere other than `options`,
     * and the test would be blind to the exact regression it guards.
     */
    it('shows no option label when the list is empty, which is the bug it guards', () => {
        render(
            <EntityFormSection
                config={buildSection({ withOptions: false })}
                values={{ kind: 'word', category: 'hate' }}
                {...baseProps}
            />
        );

        expect(screen.queryByText('content-moderation.categories.hate')).not.toBeInTheDocument();
        expect(screen.queryByText('content-moderation.terms.kinds.word')).not.toBeInTheDocument();
    });
});
