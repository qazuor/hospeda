/**
 * @file env-registry-json.guard.test.ts
 * @description Guards that the committed
 * `packages/config/generated/env-registry.json` bridge artifact (HOS-79
 * T-011/T-012) is up to date with `ENV_REGISTRY`, `CROSS_CHECK_RULES`, and
 * the 4 real pure per-app Zod schemas. Fails when:
 *   - The committed file is missing entirely.
 *   - The committed file is not valid JSON, or does not match the exact
 *     `{ registry, crossChecks, constraints }` shape (spec §7).
 *   - The committed file content differs from what the generator would
 *     produce today (drift > 0: run `pnpm gen:env-registry-json` to fix).
 *
 * This test re-implements `scripts/generate-env-registry-json.ts`'s core
 * logic INLINE rather than importing it — matching the exact convention
 * `env-examples.guard.test.ts` already uses for `generate-env-examples.ts`
 * (duplicate the logic, don't import the generator script).
 *
 * Run via:
 *   pnpm --filter @repo/config test src/__tests__/env-registry-json.guard.test.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { AdminEnvSchema } from '../../../../apps/admin/src/env-schema.js';
import { ApiEnvBaseSchema } from '../../../../apps/api/src/utils/env-schema.js';
import { EnvSchema as MobileEnvSchema } from '../../../../apps/mobile/src/lib/env-schema.js';
import { serverEnvBaseSchema } from '../../../../apps/web/src/env-schema.js';
import { CROSS_CHECK_RULES } from '../env-cross-checks.js';
import { ENV_REGISTRY } from '../env-registry.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '../../../..');
const OUTPUT_PATH = resolve(ROOT, 'packages/config/generated/env-registry.json');

// ---------------------------------------------------------------------------
// Re-implemented generator logic (must stay in sync with
// scripts/generate-env-registry-json.ts — see that file's own doc comment)
// ---------------------------------------------------------------------------

interface EnvVarConstraint {
    readonly enumValues?: readonly string[];
    readonly boolean?: true;
    readonly numeric?: { readonly min?: number; readonly max?: number };
}

type EnvVarConstraints = Record<string, EnvVarConstraint>;

interface ZodInternalDef {
    readonly type: string;
    readonly innerType?: ZodIntrospectable;
    readonly in?: ZodIntrospectable;
    readonly out?: ZodIntrospectable;
    readonly entries?: Readonly<Record<string, string>>;
}

interface ZodIntrospectable {
    readonly _zod: { readonly def: ZodInternalDef };
    readonly minValue?: number | null;
    readonly maxValue?: number | null;
}

const TRANSPARENT_WRAPPER_TYPES = new Set(['optional', 'default', 'nullable', 'prefault']);
const CONSTRAINABLE_TYPES = new Set(['enum', 'boolean', 'number']);

function toIntrospectable(schema: z.ZodTypeAny): ZodIntrospectable {
    return schema as unknown as ZodIntrospectable;
}

function unwrapToBaseSchema(schema: ZodIntrospectable): ZodIntrospectable {
    const def = schema._zod.def;

    if (TRANSPARENT_WRAPPER_TYPES.has(def.type) && def.innerType) {
        return unwrapToBaseSchema(def.innerType);
    }

    if (def.type === 'pipe' && def.out) {
        const unwrappedOut = unwrapToBaseSchema(def.out);
        if (CONSTRAINABLE_TYPES.has(unwrappedOut._zod.def.type)) {
            return unwrappedOut;
        }
        if (def.in) {
            return unwrapToBaseSchema(def.in);
        }
        return unwrappedOut;
    }

    return schema;
}

function normalizeNumericBound(
    rawValue: number | null | undefined,
    sentinel: number
): number | undefined {
    if (rawValue === null || rawValue === undefined || rawValue === sentinel) {
        return undefined;
    }
    return rawValue;
}

function extractConstraint(schema: z.ZodTypeAny): EnvVarConstraint | undefined {
    const base = unwrapToBaseSchema(toIntrospectable(schema));
    const def = base._zod.def;

    if (def.type === 'enum' && def.entries) {
        return { enumValues: Object.values(def.entries) };
    }

    if (def.type === 'boolean') {
        return { boolean: true };
    }

    if (def.type === 'number') {
        const min = normalizeNumericBound(base.minValue, Number.NEGATIVE_INFINITY);
        const max = normalizeNumericBound(base.maxValue, Number.POSITIVE_INFINITY);
        if (min === undefined && max === undefined) return undefined;
        const numeric: { min?: number; max?: number } = {};
        if (min !== undefined) numeric.min = min;
        if (max !== undefined) numeric.max = max;
        return { numeric };
    }

    return undefined;
}

const SCHEMA_SOURCES: ReadonlyArray<{ readonly shape: Record<string, z.ZodTypeAny> }> = [
    { shape: ApiEnvBaseSchema.shape },
    { shape: serverEnvBaseSchema.shape },
    { shape: AdminEnvSchema.shape },
    { shape: MobileEnvSchema.shape }
];

function buildConstraints(): EnvVarConstraints {
    const constraints: Record<string, EnvVarConstraint> = {};

    for (const { shape } of SCHEMA_SOURCES) {
        for (const [key, fieldSchema] of Object.entries(shape)) {
            if (key in constraints) continue;
            const constraint = extractConstraint(fieldSchema);
            if (constraint) constraints[key] = constraint;
        }
    }

    return constraints;
}

function buildFreshPayload() {
    return {
        registry: ENV_REGISTRY,
        crossChecks: CROSS_CHECK_RULES,
        constraints: buildConstraints()
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('env-registry.json guard', () => {
    it('should exist as a committed file', () => {
        expect(
            existsSync(OUTPUT_PATH),
            `${OUTPUT_PATH} does not exist. Fix: run pnpm gen:env-registry-json and commit the result.`
        ).toBe(true);
    });

    it('should be valid JSON with exactly the { registry, crossChecks, constraints } keys (spec §7)', () => {
        const raw = readFileSync(OUTPUT_PATH, 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        expect(parsed).toBeTypeOf('object');
        expect(Object.keys(parsed as Record<string, unknown>).sort()).toEqual([
            'constraints',
            'crossChecks',
            'registry'
        ]);
    });

    it('should embed the full ENV_REGISTRY verbatim', () => {
        const raw = readFileSync(OUTPUT_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as { registry: unknown };
        expect(parsed.registry).toEqual(ENV_REGISTRY);
    });

    it('should embed CROSS_CHECK_RULES verbatim', () => {
        const raw = readFileSync(OUTPUT_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as { crossChecks: unknown };
        expect(parsed.crossChecks).toEqual(CROSS_CHECK_RULES);
    });

    it('should have a constraints map matching a fresh introspection of the 4 real schemas', () => {
        const raw = readFileSync(OUTPUT_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as { constraints: unknown };
        expect(parsed.constraints).toEqual(buildConstraints());
    });

    it('should match freshly-generated output byte-for-byte (drift = 0)', () => {
        const committed = readFileSync(OUTPUT_PATH, 'utf-8');
        const fresh = `${JSON.stringify(buildFreshPayload(), null, 2)}\n`;
        expect(
            committed,
            'packages/config/generated/env-registry.json differs from freshly-generated output.\n\nFix: run pnpm gen:env-registry-json and commit the result.'
        ).toBe(fresh);
    });
});
