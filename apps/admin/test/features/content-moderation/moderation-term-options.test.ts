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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    createContentModerationTermSchema,
    ModerationCategoryEnum,
    updateContentModerationTermSchema
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildModerationCategoryFilterOptions,
    buildModerationCategoryOptions,
    buildModerationTermKindFilterOptions,
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

describe('the listing filter offers only values a row can hold (HOS-1068)', () => {
    it('filters by categories the schema accepts', () => {
        const { options } = buildModerationCategoryFilterOptions();
        const impossible = options.filter(({ value }) => !accepts('category', value));

        expect(
            impossible.map(({ value }) => value),
            'The category filter offers values no row can hold, so choosing one returns an empty list that reads as "no results" rather than "not a thing".'
        ).toEqual([]);
        expect(options.map(({ value }) => value)).not.toContain('self_harm');
    });

    it('filters by kinds the schema accepts', () => {
        const { options } = buildModerationTermKindFilterOptions();
        expect(options.filter(({ value }) => !accepts('kind', value))).toEqual([]);
    });

    it('carries a translation key for every filter option', () => {
        for (const { value, labelKey } of buildModerationCategoryFilterOptions().options) {
            expect(labelKey, `no label key for category '${value}'`).toBeTruthy();
        }
    });
});

/**
 * The edit screen is NOT a second copy of the create screen's bug.
 *
 * It hand-rolls its Radix `Select` instead of going through
 * `EntityFormSection`, so the `config`/`typeConfig` typo never touched it: its
 * hardcoded `self_harm` option was live the entire time. And it is strictly
 * worse than the create form was, because its handler answered a rejected
 * value with a bare `return` — no save, no navigation, no message, with
 * `field.state.meta.errors` permanently empty for want of any `validators`.
 * The operator could not tell a refusal from a dead button.
 *
 * Asserted on the source because this route needs a router to render.
 */
describe('the moderation-term EDIT form (HOS-1068)', () => {
    const EDIT_ROUTE = join(
        __dirname,
        '../../../src/routes/_authed/content/moderation-terms/$id_.edit.tsx'
    );
    const source = (): string => readFileSync(EDIT_ROUTE, 'utf8');

    it('rejects self_harm through the same schema the form validates with', () => {
        expect(updateContentModerationTermSchema.safeParse({ category: 'self_harm' }).success).toBe(
            false
        );
    });

    it('derives both selects instead of listing SelectItems by hand', () => {
        const text = source();

        expect(
            text,
            'The edit route no longer builds its options from moderation-term-options. Its Selects are hand-rolled, so nothing else stops them offering a value the schema rejects.'
        ).toMatch(
            /import\s*\{(?=[^}]*\bbuildModerationCategoryOptions\b)(?=[^}]*\bbuildModerationTermKindOptions\b)[^}]*\}\s*from\s*'@\/features\/content-moderation\/moderation-term-options'/
        );
        expect(text).toMatch(/categoryOptions\.map\(/);
        expect(text).toMatch(/kindOptions\.map\(/);
    });

    it('hardcodes no SelectItem value', () => {
        expect(
            source(),
            'The edit route declares literal <SelectItem value="…"> options again. That is how `self_harm` survived here: this screen never went through EntityFormSection, so the typo fix did not reach it.'
        ).not.toMatch(/<SelectItem\s+value="/);
    });

    it('does not answer a rejected value with silence', () => {
        const text = source();
        // Bounded forwards from `onSubmit:`, not to some later landmark: the
        // outer page component has its own `return (` ABOVE this handler, so
        // slicing to that gave an empty string and a green-looking assertion.
        const start = text.indexOf('onSubmit:');
        expect(start, 'onSubmit handler not found in the edit route').toBeGreaterThan(-1);
        const end = text.indexOf('\n    });', start);
        expect(end, 'unterminated useForm call').toBeGreaterThan(start);
        const handler = text.slice(start, end);

        expect(
            handler,
            'The edit handler swallows validation failures again. A bare `return` on !success produces no save, no navigation and no message — and with no `validators` on the fields, nothing else in this form reports anything either.'
        ).not.toMatch(/if\s*\(!validation\.success\)\s*return\s*;/);
        expect(handler, 'validation failure must surface to the operator').toContain('addToast');
    });
});
