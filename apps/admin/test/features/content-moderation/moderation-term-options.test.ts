/**
 * Regression: the moderation-term form must not offer a value its own schema
 * rejects (HOS-1068).
 *
 * The hand-written category list carried seven options; `ModerationCategoryEnum`
 * has six. `self_harm` — fifth of seven, translated in all three locales,
 * indistinguishable from the valid ones — is not a member. While the list sat
 * under the misspelled `config` key nothing read it and the defect was
 * unreachable; fixing the key made it live, so an operator choosing "Autolesión"
 * would have been refused by the submit handler's own `safeParse` over a value
 * the form had just offered.
 *
 * These assertions run the real schema rather than comparing lists, because a
 * list compared against another hand-written list is the same mistake twice.
 */
import { createContentModerationTermSchema, ModerationCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildModerationCategoryOptions,
    buildModerationTermKindOptions,
    MODERATION_CATEGORY_LABEL_KEYS,
    MODERATION_TERM_KIND_LABEL_KEYS
} from '@/features/content-moderation/moderation-term-options';

/** Identity translator: keeps the assertions about values, not copy. */
const t = (key: string): string => key;

/** Submits a term with the given field overridden, and reports acceptance. */
const accepts = (field: 'kind' | 'category', value: string): boolean =>
    createContentModerationTermSchema.safeParse({
        term: 'example',
        kind: 'word',
        category: ModerationCategoryEnum.SPAM,
        severity: 0.5,
        enabled: true,
        [field]: value
    }).success;

describe('every offered option is one the schema accepts (HOS-1068)', () => {
    it('accepts every category the form offers', () => {
        const { options } = buildModerationCategoryOptions({ t });
        const rejected = options.filter(({ value }) => !accepts('category', value));

        expect(
            rejected.map(({ value }) => value),
            'The Categoría select offers values that createContentModerationTermSchema rejects. An operator who picks one gets a validation error on a choice the form itself presented.'
        ).toEqual([]);
        expect(options.length).toBeGreaterThan(0);
    });

    it('accepts every kind the form offers', () => {
        const { options } = buildModerationTermKindOptions({ t });
        const rejected = options.filter(({ value }) => !accepts('kind', value));

        expect(rejected.map(({ value }) => value)).toEqual([]);
        expect(options.length).toBeGreaterThan(0);
    });

    /**
     * The trap case, and the exact defect this PR introduced by making the
     * dead list live: a value with a perfectly good label that nothing accepts.
     */
    it('does not offer self_harm, which is not a member of ModerationCategoryEnum', () => {
        const { options } = buildModerationCategoryOptions({ t });

        expect(accepts('category', 'self_harm')).toBe(false);
        expect(
            options.map(({ value }) => value),
            'self_harm is back on the form. It has a translated label in es/en/pt but no enum member, so the submit handler refuses it.'
        ).not.toContain('self_harm');
    });
});

describe('the form offers everything the schema accepts (HOS-1068)', () => {
    it('offers every category the schema will take, so none is unreachable', () => {
        const { options } = buildModerationCategoryOptions({ t });
        const offered = new Set(options.map(({ value }) => value));
        const missing = Object.values(ModerationCategoryEnum).filter(
            (value) => !offered.has(value)
        );

        expect(
            missing,
            `These categories exist and validate but cannot be chosen: ${missing.join(', ')}`
        ).toEqual([]);
    });

    it('offers every kind the schema will take', () => {
        const { options } = buildModerationTermKindOptions({ t });
        expect(options.map(({ value }) => value).sort()).toEqual(
            [...createContentModerationTermSchema.shape.kind.options].sort()
        );
    });
});

describe('labels (HOS-1068)', () => {
    it('labels every option through its declared translation key', () => {
        const { options } = buildModerationCategoryOptions({ t });

        for (const { value, label } of options) {
            expect(label).toBe(MODERATION_CATEGORY_LABEL_KEYS[value as ModerationCategoryEnum]);
            expect(label).not.toBe('');
        }
    });

    it('labels every kind through its declared translation key', () => {
        const { options } = buildModerationTermKindOptions({ t });

        for (const { value, label } of options) {
            expect(label).toBe(
                MODERATION_TERM_KIND_LABEL_KEYS[
                    value as keyof typeof MODERATION_TERM_KIND_LABEL_KEYS
                ]
            );
        }
    });

    it('declares no label for a value the schema does not accept', () => {
        const stray = Object.keys(MODERATION_CATEGORY_LABEL_KEYS).filter(
            (value) => !accepts('category', value)
        );

        expect(
            stray,
            `MODERATION_CATEGORY_LABEL_KEYS names values the schema rejects: ${stray.join(', ')}`
        ).toEqual([]);
    });
});
