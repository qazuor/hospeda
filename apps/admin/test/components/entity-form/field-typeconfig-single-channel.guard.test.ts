/**
 * Guard: `typeConfig` is the ONLY channel a field may declare its type-specific
 * configuration through (HOS-1068).
 *
 * `FieldConfig` used to declare TWO properties of the same type:
 * `config?: FieldTypeConfig` and `typeConfig?: FieldTypeConfig`. Every renderer
 * reads `typeConfig`; nothing anywhere in `apps/admin/src` ever read `config`.
 * So a field that declared its options under `config` typechecked cleanly,
 * rendered cleanly, and silently produced a select with zero options — which is
 * exactly what made `/content/moderation-terms/new` impossible to submit: both
 * of its required selects opened on "Sin opciones disponibles".
 *
 * Simply DELETING `config` does not close the hole, and that was measured
 * rather than assumed: with the property gone, a field literal declaring
 * `config: {...}` — or `zzzTotallyBogusProperty: 1` — still typechecks with exit
 * 0. The form-config prop is typed `ConsolidatedSectionConfig[] |
 * SectionConfig[]`, and TypeScript performs no excess-property check against a
 * union target, so every route call site accepts unknown keys in silence.
 *
 * Two defenses close it, and this guard keeps both in place:
 *
 *  1. `FieldConfig.config` is declared `never`. Assigning an object to `never`
 *     fails on its own terms, with no dependence on freshness, so the exact
 *     historical typo is now an error in all 93+ forms at once without touching
 *     any of them.
 *  2. This route's sections carry `satisfies SectionConfig[]`, which restores
 *     excess-property checking for the whole literal — that is what catches the
 *     NEXT misspelling, the one nobody has reserved a name for.
 *
 * Verified by mutation: reverting either defense reproduces a typecheck that
 * passes over the original bug.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FIELD_CONFIG_TYPES = join(
    __dirname,
    '../../../src/components/entity-form/types/field-config.types.ts'
);
const MODERATION_TERM_NEW_ROUTE = join(
    __dirname,
    '../../../src/routes/_authed/content/moderation-terms/new.tsx'
);

const read = (absolutePath: string): string => readFileSync(absolutePath, 'utf8');

/**
 * Returns the source of the object/type body that opens at `openIndex`,
 * closed by brace matching so nested literals stay inside the slice.
 */
const sliceBraceBlock = (source: string, openIndex: number, what: string): string => {
    let depth = 0;
    for (let i = openIndex; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(openIndex, i + 1);
        }
    }
    throw new Error(`unterminated block for ${what}`);
};

/**
 * Returns the source of the `FieldConfig` type body.
 *
 * Anchored on the declaration rather than a bare search for `config?:`, so the
 * many OTHER `*FieldConfig` types in this file (which legitimately have their
 * own members) can neither satisfy nor trip the assertion.
 */
const readFieldConfigBody = (source: string): string => {
    const declaration = 'export type FieldConfig = {';
    const start = source.indexOf(declaration);
    expect(start, `${declaration} not found`).toBeGreaterThan(-1);
    return sliceBraceBlock(source, start + declaration.length - 1, 'FieldConfig');
};

/**
 * Returns the source of a single field object literal inside a form config,
 * located by its `id: '<fieldId>'` line and closed by brace matching.
 */
const readFieldLiteral = (source: string, fieldId: string): string => {
    const idIndex = source.indexOf(`id: '${fieldId}'`);
    expect(idIndex, `field '${fieldId}' not found in the route source`).toBeGreaterThan(-1);

    const open = source.lastIndexOf('{', idIndex);
    expect(open, `no opening brace before field '${fieldId}'`).toBeGreaterThan(-1);

    return sliceBraceBlock(source, open, `field '${fieldId}'`);
};

/** Returns the brace-matched `typeConfig: { ... }` object of a field literal. */
const readTypeConfig = (fieldLiteral: string, fieldId: string): string => {
    const key = 'typeConfig:';
    const keyIndex = fieldLiteral.indexOf(key);
    expect(
        keyIndex,
        `Field '${fieldId}' of /content/moderation-terms/new declares no typeConfig. EntityFormSection reads options, min/max and step from typeConfig only; anywhere else they are dropped without an error and the field renders empty.`
    ).toBeGreaterThan(-1);

    const open = fieldLiteral.indexOf('{', keyIndex);
    expect(open, `typeConfig of '${fieldId}' is not an object literal`).toBeGreaterThan(-1);

    return sliceBraceBlock(fieldLiteral, open, `typeConfig of '${fieldId}'`);
};

describe('FieldConfig exposes exactly one type-config channel (HOS-1068)', () => {
    it('reserves `config` as `never` so the historical typo cannot be assigned', () => {
        const body = readFieldConfigBody(read(FIELD_CONFIG_TYPES));

        // Anchored to a top-level member of the type (four-space indent, then
        // the key), so a `config` nested inside some member's inline object
        // literal is neither mistaken for the reservation nor able to satisfy it.
        const declaration = / {4}config\?:\s*([^;]+);/.exec(body);

        expect(
            declaration,
            'FieldConfig no longer reserves `config`. Deleting the property is NOT enough: the form-config prop is a union of array types, against which TypeScript skips excess-property checking, so an undeclared `config: {...}` typechecks at every route call site exactly as it did in HOS-1068. Declare `config?: never;`.'
        ).not.toBeNull();

        expect(
            declaration?.[1].trim(),
            'FieldConfig declares `config` with a real type again. No renderer reads it, so anything written there is dropped in silence — which is how both required selects of /content/moderation-terms/new came to render "no options available". It must stay `never`.'
        ).toBe('never');
    });

    it('still declares the `typeConfig` property every renderer reads', () => {
        const body = readFieldConfigBody(read(FIELD_CONFIG_TYPES));

        expect(
            /^ {4}typeConfig\??:/m.test(body),
            'FieldConfig no longer declares `typeConfig`, which EntityFormSection reads for select options, number bounds and textarea limits.'
        ).toBe(true);
    });
});

describe('the moderation-term create form declares its options where the renderer reads them (HOS-1068)', () => {
    const CONFIGURED_FIELDS = ['kind', 'category', 'severity'] as const;

    /**
     * `config?: never` only stops the ONE name that has already burned us.
     * `satisfies` is what makes the compiler reject a key nobody anticipated,
     * and without it this file's literal is checked against nothing.
     */
    it('pins its sections with `satisfies` so unknown keys are rejected', () => {
        expect(
            read(MODERATION_TERM_NEW_ROUTE),
            'The sections literal of /content/moderation-terms/new no longer carries `satisfies SectionConfig[]`. Without it TypeScript performs no excess-property check on this form — a misspelled field key is accepted silently and surfaces months later as an empty control.'
        ).toMatch(/\]\s*satisfies\s+SectionConfig\[\]/);
    });

    for (const fieldId of CONFIGURED_FIELDS) {
        it(`field '${fieldId}' carries its configuration under typeConfig`, () => {
            const literal = readFieldLiteral(read(MODERATION_TERM_NEW_ROUTE), fieldId);
            // Throws with the explanatory message when typeConfig is absent.
            expect(readTypeConfig(literal, fieldId).length).toBeGreaterThan(0);
        });
    }

    it('both required selects actually offer their options', () => {
        const source = read(MODERATION_TERM_NEW_ROUTE);

        // The values that must be selectable for a term to be creatable at all.
        // Asserted INSIDE each field's own typeConfig object, so options left
        // behind in a sibling `config` cannot make this pass.
        const kind = readTypeConfig(readFieldLiteral(source, 'kind'), 'kind');
        for (const value of ['word', 'domain']) {
            expect(kind, `term kind '${value}' is no longer offered`).toContain(
                `value: '${value}'`
            );
        }

        const category = readTypeConfig(readFieldLiteral(source, 'category'), 'category');
        for (const value of [
            'hate',
            'sexual',
            'violence',
            'harassment',
            'self_harm',
            'spam',
            'other'
        ]) {
            expect(category, `moderation category '${value}' is no longer offered`).toContain(
                `value: '${value}'`
            );
        }
    });
});
