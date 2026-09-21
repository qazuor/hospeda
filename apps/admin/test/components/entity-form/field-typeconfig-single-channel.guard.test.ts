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
 * Simply DELETING `config` did not close the hole here, and that was measured
 * rather than assumed: with the property gone, a field literal in THIS route
 * declaring `config: {...}` — or `zzzTotallyBogusProperty: 1` — still
 * typechecked with exit 0.
 *
 * The reason is narrow, and worth stating precisely because the first draft of
 * this comment overstated it. TypeScript performs no excess-property check when
 * the contextual type is a union, and the form prop is
 * `ConsolidatedSectionConfig[] | SectionConfig[]`. But almost nothing assigns a
 * literal straight to that prop: the other 92 forms build their sections in
 * factories with an ANNOTATED RETURN TYPE, which checks them fine — the same
 * bogus key in `features/amenities/config/sections/flags.consolidated.ts` fails
 * with TS2353. An inline `sections: [` appears exactly once under `src/routes`,
 * and it was this file. One unprotected literal, not ninety-three.
 *
 * Two defenses, and this guard keeps both in place:
 *
 *  1. `FieldConfig.config` is declared `never`. Assigning an object to `never`
 *     fails on its own terms, with no dependence on freshness, so the exact
 *     historical typo is refused everywhere — including wherever a union target
 *     would otherwise have let it through.
 *  2. This route's sections carry `satisfies SectionConfig[]`, which restores
 *     excess-property checking for the one literal that lacked it. That is what
 *     catches the NEXT misspelling, the one nobody has reserved a name for.
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

        // Anchored on a line start and a word boundary rather than on an exact
        // indent: a Biome reformat must not be able to retire this guard in
        // silence. Members of the OTHER `*FieldConfig` types in this file are
        // excluded by slicing FieldConfig's own body first.
        const declaration = /^\s*\bconfig\?:\s*([^;]+);/m.exec(body);

        expect(
            declaration,
            'FieldConfig no longer reserves `config`. Deleting the property is not enough on its own: a literal assigned straight to the union-typed form prop (`ConsolidatedSectionConfig[] | SectionConfig[]`) gets no excess-property check, so `config: {...}` would typecheck there exactly as it did in HOS-1068. Declare `config?: never;`.'
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
     * `satisfies` is what makes the compiler reject a key nobody anticipated.
     *
     * It matters HERE specifically. The other 92 forms build their sections in
     * factories with an annotated return type, which already gives them the
     * check; this route is the only place under `src/routes` that assigns a
     * `sections: [...]` literal straight to the union-typed prop, and a union
     * target is the case TypeScript skips. So this file was the one literal in
     * the app without excess-property checking, and `satisfies` is what closed
     * it.
     */
    it('pins its sections with `satisfies` so unknown keys are rejected', () => {
        expect(
            read(MODERATION_TERM_NEW_ROUTE),
            'The sections literal of /content/moderation-terms/new no longer carries `satisfies SectionConfig[]`. This route assigns its literal directly to the union-typed form prop, where TypeScript performs no excess-property check, so a misspelled field key is accepted silently and surfaces months later as an empty control.'
        ).toMatch(/\]\s*satisfies\s+SectionConfig\[\]/);
    });

    for (const fieldId of CONFIGURED_FIELDS) {
        it(`field '${fieldId}' carries its configuration under typeConfig`, () => {
            const literal = readFieldLiteral(read(MODERATION_TERM_NEW_ROUTE), fieldId);
            // Throws with the explanatory message when typeConfig is absent.
            expect(readTypeConfig(literal, fieldId).length).toBeGreaterThan(0);
        });
    }

    /**
     * Deliberately NOT a frozen list of the option values.
     *
     * An earlier version of this guard pinned the seven categories the route
     * used to hardcode — `self_harm` among them, which the schema rejects. A
     * frozen list cannot tell a correct removal from a regression: it would
     * have greeted whoever deleted the invalid option with a red test claiming
     * they broke something. What the options must BE is asserted against the
     * schema itself in
     * `test/features/content-moderation/moderation-term-options.test.ts`; what
     * this file asserts is only that the route still gets them from there.
     */
    it('feeds both selects from the schema-derived builders, not a hand-written list', () => {
        const source = read(MODERATION_TERM_NEW_ROUTE);

        expect(
            source,
            'The moderation-term route no longer imports its select options from @/features/content-moderation/moderation-term-options. Hand-writing them is what let the form offer `self_harm`, a value createContentModerationTermSchema rejects.'
        ).toMatch(
            /import\s*\{[^}]*\bbuildModerationCategoryOptions\b[^}]*\}\s*from\s*'@\/features\/content-moderation\/moderation-term-options'/
        );

        expect(readTypeConfig(readFieldLiteral(source, 'kind'), 'kind')).toContain('kindOptions');
        expect(readTypeConfig(readFieldLiteral(source, 'category'), 'category')).toContain(
            'categoryOptions'
        );
    });

    it('hardcodes no option value in the route', () => {
        const source = read(MODERATION_TERM_NEW_ROUTE);

        for (const fieldId of ['kind', 'category'] as const) {
            expect(
                readTypeConfig(readFieldLiteral(source, fieldId), fieldId),
                `Field '${fieldId}' declares literal option values again. They must come from createContentModerationTermSchema so the form cannot offer something the submit handler refuses.`
            ).not.toMatch(/\bvalue:\s*'/);
        }
    });
});
