/**
 * @file generate-env-registry-json.test.ts
 * @description Fixture-driven unit tests for the `pnpm gen:env-registry-json`
 * generator (HOS-79 T-011). Covers the Zod-introspection unwrap logic across
 * every wrapper shape found in the 4 real per-app pure schemas
 * (`.optional()`, `.default()`, `.pipe()`-chained transforms, `.refine()`),
 * plus a lightweight integration sanity check against the real schemas and
 * registry.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CROSS_CHECK_RULES } from '../../packages/config/src/env-cross-checks.js';
import { ENV_REGISTRY } from '../../packages/config/src/env-registry.js';
import {
    buildConstraints,
    buildEnvRegistryJson,
    extractConstraint,
    toIntrospectable,
    unwrapToBaseSchema
} from '../generate-env-registry-json.js';

describe('unwrapToBaseSchema', () => {
    it('should unwrap a plain enum (no wrapper) to itself', () => {
        const base = unwrapToBaseSchema(toIntrospectable(z.enum(['a', 'b'])));
        expect(base._zod.def.type).toBe('enum');
    });

    it('should unwrap through .optional()', () => {
        const base = unwrapToBaseSchema(toIntrospectable(z.enum(['a', 'b']).optional()));
        expect(base._zod.def.type).toBe('enum');
    });

    it('should unwrap through .default()', () => {
        const base = unwrapToBaseSchema(toIntrospectable(z.coerce.boolean().default(true)));
        expect(base._zod.def.type).toBe('boolean');
    });

    it('should unwrap through stacked .optional().default() equivalents (number)', () => {
        const base = unwrapToBaseSchema(
            toIntrospectable(z.coerce.number().min(1).max(9).default(6))
        );
        expect(base._zod.def.type).toBe('number');
    });

    it('should unwrap a .pipe() chain to the enum on the "out" side (API_LOG_LEVEL pattern)', () => {
        const schema = z
            .string()
            .transform((val) => val.toLowerCase())
            .pipe(z.enum(['debug', 'info', 'warn', 'error']))
            .default('info');
        const base = unwrapToBaseSchema(toIntrospectable(schema));
        expect(base._zod.def.type).toBe('enum');
    });

    it('should fall back to the "in" side of a .pipe() when "out" is a bare transform (boolean-flag pattern)', () => {
        const schema = z
            .string()
            .optional()
            .transform((v) => v === 'true');
        const base = unwrapToBaseSchema(toIntrospectable(schema));
        // "out" is a transform node with no constraint data; "in" unwraps to a
        // plain string — neither is constrainable, but this must not throw and
        // must resolve to SOME schema (the plain string).
        expect(base._zod.def.type).toBe('string');
    });

    it('should leave a .refine()-wrapped string as a plain string (refine does not change the base type)', () => {
        const schema = z
            .string()
            .refine((val) => ['development', 'production', 'test'].includes(val));
        const base = unwrapToBaseSchema(toIntrospectable(schema));
        expect(base._zod.def.type).toBe('string');
    });
});

describe('extractConstraint', () => {
    it('should extract enumValues from a plain enum', () => {
        expect(extractConstraint(z.enum(['a', 'b', 'c']))).toEqual({ enumValues: ['a', 'b', 'c'] });
    });

    it('should extract enumValues from an optional enum with a default', () => {
        expect(extractConstraint(z.enum(['dev', 'prod']).default('dev'))).toEqual({
            enumValues: ['dev', 'prod']
        });
    });

    it('should extract boolean: true from a coerced boolean', () => {
        expect(extractConstraint(z.coerce.boolean().default(false))).toEqual({ boolean: true });
    });

    it('should extract numeric min+max from a bounded number', () => {
        expect(extractConstraint(z.coerce.number().min(1).max(9).default(6))).toEqual({
            numeric: { min: 1, max: 9 }
        });
    });

    it('should extract numeric with only min when no max is set (.positive())', () => {
        const result = extractConstraint(z.coerce.number().positive().default(3001));
        expect(result?.numeric?.min).toBeDefined();
        expect(result?.numeric?.max).toBeUndefined();
    });

    it('should return undefined for a plain unbounded number (no min/max at all)', () => {
        expect(extractConstraint(z.coerce.number().default(1000))).toBeUndefined();
    });

    it('should return undefined for a plain string (e.g. a URL)', () => {
        expect(extractConstraint(z.string().url().optional())).toBeUndefined();
    });

    it('should return undefined for a string+transform boolean-flag pattern (schema stays ZodString)', () => {
        const schema = z
            .string()
            .optional()
            .transform((v) => v === 'true');
        expect(extractConstraint(schema)).toBeUndefined();
    });

    it('should extract enumValues through a .pipe()-chained transform+enum+default (API_LOG_LEVEL pattern)', () => {
        const schema = z
            .string()
            .transform((val) => val.toLowerCase())
            .pipe(z.enum(['debug', 'info', 'warn', 'error']))
            .default('info');
        expect(extractConstraint(schema)).toEqual({
            enumValues: ['debug', 'info', 'warn', 'error']
        });
    });
});

describe('buildConstraints', () => {
    it('should key the constraints map by env var NAME across all 4 real schemas', () => {
        const constraints = buildConstraints();
        // Known enum var from apps/api/src/utils/env-schema.ts
        expect(constraints.HOSPEDA_MODERATION_PROVIDER).toEqual({
            enumValues: ['openai', 'local', 'stub']
        });
        // Known boolean var
        expect(constraints.API_ENABLE_REQUEST_LOGGING).toEqual({ boolean: true });
        // Known bounded-number var
        expect(constraints.API_COMPRESSION_LEVEL).toEqual({ numeric: { min: 1, max: 9 } });
        // Known mobile-only enum var
        expect(constraints.EXPO_PUBLIC_APP_ENV).toEqual({
            enumValues: ['development', 'staging', 'production']
        });
    });

    it('should not include a key for a var with no extractable constraint (e.g. a plain URL)', () => {
        const constraints = buildConstraints();
        expect(constraints.HOSPEDA_API_URL).toBeUndefined();
    });

    it('should let the FIRST schema (api) win for NODE_ENV, which is a weaker .refine() string in admin', () => {
        const constraints = buildConstraints();
        // api's NODE_ENV is a real z.enum(...); admin's NODE_ENV is z.string().refine(...)
        // (not an enum at the schema level) — api must win since it is processed first.
        expect(constraints.NODE_ENV).toEqual({
            enumValues: ['development', 'production', 'test']
        });
    });
});

describe('buildEnvRegistryJson', () => {
    it('should match the exact spec §7 shape: { registry, crossChecks, constraints }', () => {
        const payload = buildEnvRegistryJson();
        expect(Object.keys(payload).sort()).toEqual(['constraints', 'crossChecks', 'registry']);
    });

    it('should embed the full ENV_REGISTRY verbatim', () => {
        const payload = buildEnvRegistryJson();
        expect(payload.registry).toEqual(ENV_REGISTRY);
    });

    it('should embed CROSS_CHECK_RULES verbatim', () => {
        const payload = buildEnvRegistryJson();
        expect(payload.crossChecks).toEqual(CROSS_CHECK_RULES);
    });

    it('should be JSON-serializable with no functions/undefined leaking through', () => {
        const payload = buildEnvRegistryJson();
        const roundTripped = JSON.parse(JSON.stringify(payload));
        expect(roundTripped).toEqual(payload);
    });
});
