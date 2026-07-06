#!/usr/bin/env tsx

/**
 * @file generate-env-registry-json.ts
 * @description Generates the committed JSON bridge
 * (`packages/config/generated/env-registry.json`) that lets the bun-standalone
 * `hops` CLI (`scripts/server-tools`) read the env-var registry, cross-check
 * rules, and Zod-introspected value constraints as plain data — zero
 * TypeScript parsing, zero pnpm/node_modules dependency on the VPS (HOS-79
 * — Env Var Management Hardening, spec §6.C).
 *
 * Kept as a SEPARATE sibling script from `generate-env-examples.ts` (whose
 * `main()` runs unconditionally at module load, no import-safety guard).
 *
 * The `constraints` map is built via READ-ONLY introspection of the 4 pure
 * per-app Zod schemas (`apps/{api,web,admin,mobile}/**\/env-schema.ts` —
 * safe to import from a plain root script; see those files' own docs for why).
 * This is intentionally the ONLY direction: schemas are inspected to produce
 * hints for the wizard's prompts (enum options, boolean flag, numeric
 * bounds) — this generator never creates or mutates a schema, and no other
 * script should ever generate a Zod schema FROM the registry (spec NG-3).
 *
 * When the same env var name is defined across more than one app's schema
 * (e.g. `NODE_ENV`), the FIRST schema in {@link SCHEMA_SOURCES} order to
 * yield an extractable constraint wins; later schemas never overwrite an
 * already-recorded constraint for that key. This keeps the merge
 * deterministic without needing conflict-resolution logic.
 *
 * Usage:
 *   pnpm gen:env-registry-json
 *
 * Output:
 *   packages/config/generated/env-registry.json
 *
 * A guard test (`packages/config/src/__tests__/env-registry-json.guard.test.ts`)
 * re-implements this generator's core logic inline (rather than importing it,
 * matching the `env-examples.guard.test.ts` convention) and asserts the
 * committed file is byte-for-byte up to date.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { AdminEnvSchema } from '../apps/admin/src/env-schema.js';
import { ApiEnvBaseSchema } from '../apps/api/src/utils/env-schema.js';
import { EnvSchema as MobileEnvSchema } from '../apps/mobile/src/lib/env-schema.js';
import { serverEnvBaseSchema } from '../apps/web/src/env-schema.js';
import type { CrossCheckRule } from '../packages/config/src/env-cross-checks.js';
import { CROSS_CHECK_RULES } from '../packages/config/src/env-cross-checks.js';
import { ENV_REGISTRY } from '../packages/config/src/env-registry.js';
import type { AppId, EnvVarDefinition } from '../packages/config/src/env-registry-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Value constraint introspected from an env var's real Zod schema, used to
 * drive the interactive wizard's prompts (select for enums, boolean toggle,
 * numeric input bounds). Matches spec §7's generated JSON shape exactly.
 */
export interface EnvVarConstraint {
    /** Allowed values, extracted from a `z.enum([...])` (or equivalent) schema node. */
    readonly enumValues?: readonly string[];
    /** Present (always `true`) when the underlying schema node is `z.boolean()`. */
    readonly boolean?: true;
    /** Numeric bounds, extracted from `.min()`/`.max()` (or equivalent) checks. */
    readonly numeric?: { readonly min?: number; readonly max?: number };
}

/** Per-var-name map of introspected constraints. */
export type EnvVarConstraints = Record<string, EnvVarConstraint>;

/** Shape of the committed `env-registry.json` artifact (spec §7). */
export interface EnvRegistryJson {
    readonly registry: readonly EnvVarDefinition[];
    readonly crossChecks: readonly CrossCheckRule[];
    readonly constraints: EnvVarConstraints;
}

/**
 * Minimal internal-zod-shape used for read-only structural introspection.
 * Zod v4 stores each schema's definition under `_zod.def` — not part of the
 * officially documented public API, but the same shape every zod v4 schema
 * exposes (verified against the installed zod 4.3.6). We ONLY read this
 * structure, never construct/mutate a schema from it (spec NG-3).
 */
interface ZodInternalDef {
    readonly type: string;
    readonly innerType?: ZodIntrospectable;
    readonly in?: ZodIntrospectable;
    readonly out?: ZodIntrospectable;
    readonly entries?: Readonly<Record<string, string>>;
}

/** A zod schema instance, viewed only through the internal fields we read. */
interface ZodIntrospectable {
    readonly _zod: { readonly def: ZodInternalDef };
    readonly minValue?: number | null;
    readonly maxValue?: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUTPUT_PATH = resolve(ROOT, 'packages/config/generated/env-registry.json');

/**
 * Wrapper def types that carry no constraint information themselves but wrap
 * an inner schema that might: unwrap through these to reach the base type.
 */
const TRANSPARENT_WRAPPER_TYPES = new Set(['optional', 'default', 'nullable', 'prefault']);

/** Def types considered "constrainable" — the only ones we extract data from. */
const CONSTRAINABLE_TYPES = new Set(['enum', 'boolean', 'number']);

/**
 * Per-app pure schema shapes to introspect, in deterministic precedence
 * order (first schema to yield a constraint for a given key wins — see the
 * file-level doc comment above).
 */
const SCHEMA_SOURCES: ReadonlyArray<{
    readonly appId: AppId;
    readonly shape: Record<string, z.ZodTypeAny>;
}> = [
    { appId: 'api', shape: ApiEnvBaseSchema.shape },
    { appId: 'web', shape: serverEnvBaseSchema.shape },
    { appId: 'admin', shape: AdminEnvSchema.shape },
    { appId: 'mobile', shape: MobileEnvSchema.shape }
];

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Casts a Zod schema to the minimal introspectable shape used by this
 * generator. A single, well-documented bridge point between `zod`'s public
 * `z.ZodTypeAny` type and the internal `_zod.def` structure we read.
 *
 * @param schema - Any Zod schema instance.
 * @returns The same instance, typed for internal-structure introspection.
 */
export function toIntrospectable(schema: z.ZodTypeAny): ZodIntrospectable {
    return schema as unknown as ZodIntrospectable;
}

/**
 * Recursively unwraps a Zod schema through transparent wrappers
 * (`.optional()`, `.default()`, `.nullable()`, `.prefault()`) and `.pipe()`
 * chains to reach the innermost "base" schema that actually carries
 * constraint data (an enum, boolean, or number node).
 *
 * For a `.pipe()` node (e.g. `z.string().transform(...).pipe(z.enum([...]))`),
 * the pipe's `out` side is tried first (the final validated shape); if that
 * does not resolve to a constrainable type (e.g. a bare `.transform()` with
 * no further pipe), the `in` side is tried as a fallback.
 *
 * @param schema - The schema (already cast to {@link ZodIntrospectable}) to unwrap.
 * @returns The innermost schema reached by unwrapping.
 */
export function unwrapToBaseSchema(schema: ZodIntrospectable): ZodIntrospectable {
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

/**
 * Normalizes a raw `minValue`/`maxValue` reading from a Zod number schema to
 * `undefined` when it represents "no bound" — either `null` (the getter's
 * value when the OTHER side has a check but this one doesn't) or the
 * `sentinel` infinity (the getter's value when NEITHER side has any check).
 *
 * @param rawValue - The raw `minValue`/`maxValue` getter result.
 * @param sentinel - `-Infinity` for a min bound, `Infinity` for a max bound.
 * @returns The bound as a finite number, or `undefined` if unbounded.
 */
function normalizeNumericBound(
    rawValue: number | null | undefined,
    sentinel: number
): number | undefined {
    if (rawValue === null || rawValue === undefined || rawValue === sentinel) {
        return undefined;
    }
    return rawValue;
}

/**
 * Extracts a {@link EnvVarConstraint} from a single Zod schema, if any of
 * `enumValues` / `boolean` / `numeric` can be determined. Returns
 * `undefined` when the (unwrapped) base schema is a plain string, object,
 * or any other type this generator does not derive prompt hints from.
 *
 * @param schema - The raw per-key schema from a pure app schema's `.shape`.
 * @returns The extracted constraint, or `undefined` if none applies.
 */
export function extractConstraint(schema: z.ZodTypeAny): EnvVarConstraint | undefined {
    const base = unwrapToBaseSchema(toIntrospectable(schema));
    const def = base._zod.def;

    if (def.type === 'enum' && def.entries) {
        return { enumValues: Object.values(def.entries) };
    }

    if (def.type === 'boolean') {
        return { boolean: true };
    }

    if (def.type === 'number') {
        // Zod v4's `minValue`/`maxValue` getters are NOT a consistent "null when
        // unbounded" API: when NO bound check exists at all they return the
        // sentinels `-Infinity`/`Infinity`; when only ONE side has a check
        // (e.g. `.positive()`, min-only), the OTHER side's getter returns
        // `null` instead. Both must be normalized to "no bound" here, or an
        // unbounded number silently produces a bogus `{ min: -Infinity, max:
        // Infinity }` constraint (caught by generate-env-registry-json.test.ts).
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

/**
 * Builds the full {@link EnvVarConstraints} map by introspecting every key
 * across all 4 pure per-app schemas ({@link SCHEMA_SOURCES}), in order. The
 * first schema to yield an extractable constraint for a given var name wins.
 *
 * @returns The constraints map, keyed by env var name.
 */
export function buildConstraints(): EnvVarConstraints {
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

/**
 * Assembles the full {@link EnvRegistryJson} payload: the registry, the
 * cross-check rules, and the introspected constraints map.
 *
 * @returns The complete JSON-serializable payload.
 */
export function buildEnvRegistryJson(): EnvRegistryJson {
    return {
        registry: ENV_REGISTRY,
        crossChecks: CROSS_CHECK_RULES,
        constraints: buildConstraints()
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Entry point: writes the committed `env-registry.json` artifact.
 */
function main(): void {
    const payload = buildEnvRegistryJson();
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    console.log(`Generated ${OUTPUT_PATH}`);
}

// Run only when invoked as a script (skip when imported by tests).
const isMainModule =
    process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    main();
}
