/**
 * AC-C50 (spec HOS-2335 §6.9, HOS-2348) — no free text can reach the
 * assistant history through `auditDetails`.
 *
 * The audit row stores lengths, never content (C-3, NG-10), and the owner's
 * history shows what the row holds. `auditDetails` is the one place a tool
 * could still leak text: a value copied from the input. This test calls every
 * registered tool's `auditDetails` with inputs built from the tool's own
 * schema, every string at its LONGEST allowed length, and fails when a string
 * value is longer than {@link MAX_AUDIT_DETAIL_LENGTH}. An enum or a literal is
 * built from its longest option, so passing a closed value through is allowed
 * and passing user text through is not.
 *
 * It iterates `MCP_TOOL_DEFINITIONS`, so a new tool is covered without editing
 * this file. A tool whose schema it cannot sample fails loudly rather than
 * being skipped. A cross-field refinement (`superRefine`) is not modelled, so
 * the sample may not pass the full schema; `auditDetails` only reads fields,
 * so it is called with the sample as is in that case.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MCP_TOOL_DEFINITIONS } from '../../../src/mcp/tools/registry';
import type { ToolAuditDetails } from '../../../src/mcp/tools/tool-definition';

/** Longest string an `auditDetails` value may hold (AC-C50). */
const MAX_AUDIT_DETAIL_LENGTH = 40;

/** Length used for a string with no declared maximum. */
const UNBOUNDED_STRING_LENGTH = 500;

/** A valid UUID, for id fields. */
const SAMPLE_UUID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

type SampleMode = 'full' | 'required';

/** The longest option of a closed set of string or number values. */
function longest(values: readonly unknown[]): unknown {
    return [...values].sort((a, b) => String(b).length - String(a).length)[0];
}

/**
 * Builds a value a schema accepts: strings at their longest, enums at their
 * longest option. `required` mode leaves every optional field out, so both
 * branches of an "is this field present" check are exercised.
 */
function sample(schema: z.ZodType, mode: SampleMode): unknown {
    if (schema instanceof z.ZodOptional) {
        return mode === 'required' ? undefined : sample(schema.unwrap() as z.ZodType, mode);
    }
    if (schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault) {
        return mode === 'required' ? undefined : sample(schema.unwrap() as z.ZodType, mode);
    }
    if (schema instanceof z.ZodNullable) return sample(schema.unwrap() as z.ZodType, mode);
    if (schema instanceof z.ZodPipe) return sample(schema.in as z.ZodType, mode);
    if (schema instanceof z.ZodEnum) return longest(schema.options);
    if (schema instanceof z.ZodLiteral) return longest([...schema.values]);
    if (schema instanceof z.ZodUUID) return SAMPLE_UUID;
    if (schema instanceof z.ZodURL) return `https://example.test/${'a'.repeat(60)}`;
    if (schema instanceof z.ZodString) {
        return 'x'.repeat(schema.maxLength ?? UNBOUNDED_STRING_LENGTH);
    }
    if (schema instanceof z.ZodNumber) return schema.minValue ?? 1;
    if (schema instanceof z.ZodBoolean) return true;
    if (schema instanceof z.ZodArray) {
        return mode === 'required' ? [] : [sample(schema.element as z.ZodType, mode)];
    }
    if (schema instanceof z.ZodObject) return sampleObject(schema, mode);
    if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
        return sample(schema.options[0] as z.ZodType, mode);
    }
    throw new Error(`audit-details registry test cannot sample a ${schema.def.type} schema`);
}

/** {@link sample} for an object schema: one sampled value per present field. */
function sampleObject(schema: z.ZodObject, mode: SampleMode): Record<string, unknown> {
    const entries = Object.entries(schema.shape as Record<string, z.ZodType>)
        .map(([key, field]) => [key, sample(field, mode)] as const)
        .filter(([, value]) => value !== undefined);
    return Object.fromEntries(entries);
}

/** String values of a details record longer than the limit. */
function tooLong(details: ToolAuditDetails | undefined): readonly string[] {
    return Object.entries(details ?? {})
        .filter(([, value]) => typeof value === 'string' && value.length > MAX_AUDIT_DETAIL_LENGTH)
        .map(([key]) => key);
}

const withDetails = MCP_TOOL_DEFINITIONS.filter(
    (definition) => definition.auditDetails !== undefined
);

describe('auditDetails carries no free text (AC-C50)', () => {
    it('covers at least the two-step tools', () => {
        expect(withDetails.map((definition) => definition.name)).toEqual(
            expect.arrayContaining(['reply_inquiry', 'create_listing'])
        );
    });

    describe.each(['full', 'required'] as const)('with %s inputs', (mode) => {
        it.each(
            withDetails.map((definition) => [definition.name, definition] as const)
        )('%s holds no string over 40 characters', (_name, definition) => {
            // Arrange: an input shaped by the tool's own schema. A cross-field
            // refinement may still refuse it; the parsed value is used when
            // the schema accepts it (defaults and transforms applied), the
            // raw sample otherwise: `auditDetails` only reads fields.
            const raw = sampleObject(definition.inputSchema, mode);
            const parsed = definition.inputSchema.safeParse(raw);

            // Act
            const details = definition.auditDetails?.({
                input: parsed.success ? parsed.data : raw
            });

            // Assert
            expect(tooLong(details)).toEqual([]);
        });
    });

    it('is not vacuous: a tool that copies its text into details fails', () => {
        // Arrange: what a leaking tool would look like.
        const schema = z.object({ text: z.string().max(2000), kind: z.enum(['a', 'b']) });
        const leaking = ({ input }: { readonly input: z.output<typeof schema> }) => ({
            kind: input.kind,
            text: input.text
        });

        // Act
        const parsed = schema.parse(sampleObject(schema, 'full'));

        // Assert
        expect(tooLong(leaking({ input: parsed }))).toEqual(['text']);
        expect(tooLong({ kind: 'a'.repeat(MAX_AUDIT_DETAIL_LENGTH) })).toEqual([]);
        expect(tooLong({ kind: 'a'.repeat(MAX_AUDIT_DETAIL_LENGTH + 1) })).toEqual(['kind']);
    });
});
