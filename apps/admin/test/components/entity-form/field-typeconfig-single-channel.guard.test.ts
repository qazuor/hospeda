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
 * Two assertions, because the hole has two halves:
 *
 *  1. The dead twin must stay deleted. While `config` is a declared property of
 *     `FieldConfig`, excess-property checking cannot reject it and the next typo
 *     costs another few months. With it gone, `config:` on any field literal is a
 *     typecheck error in all 93+ files at once — that is the real defense, and
 *     this test only keeps it from being undone.
 *  2. The one route that had the typo declares its select options where the
 *     renderer looks. Asserted on the brace-matched `typeConfig` object of each
 *     FIELD, so neither another field's `typeConfig` nor a leftover `config`
 *     sibling can vouch for it.
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
    it('does not declare a `config` property alongside `typeConfig`', () => {
        const body = readFieldConfigBody(read(FIELD_CONFIG_TYPES));

        // Anchored to a top-level member of the type (four-space indent, then
        // the key), so a `config` nested inside some member's inline object
        // literal is not mistaken for the dead twin.
        expect(
            /^ {4}config\??:/m.test(body),
            'FieldConfig declares a `config` property again. No renderer reads it — declaring it re-opens HOS-1068, where options written under `config` were silently dropped and the select rendered "no options available". Type-specific configuration goes under `typeConfig`.'
        ).toBe(false);
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
