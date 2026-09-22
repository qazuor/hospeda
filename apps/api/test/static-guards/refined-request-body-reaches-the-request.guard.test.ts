/**
 * GUARD (HOS-425): a `requestBody` that declares a cross-field rule must still
 * enforce it once the route factory is done with the schema.
 *
 * ## What went wrong, and why nothing noticed for a year
 *
 * `createOpenAPISchema()` rebuilds an object body from its `shape` so the
 * schema can be rendered as OpenAPI. A fresh `z.object()` carries no checks, so
 * the rebuild dropped every `.refine()` / `.superRefine()` — and the factory
 * hands that rebuilt copy to the RUNTIME body validator, not just to the
 * document. Ten routes declared a cross-field rule that never ran.
 *
 * The two places that were supposed to prevent this both tested
 * `_def.typeName === 'ZodEffects'`, a Zod 3 marker that is undefined on every
 * Zod 4 schema. Nothing failed, because nothing was checking the OUTCOME.
 *
 * ## How this guard is built, and what each half defends
 *
 * **Half one — through the public factories.** Real routes are built with the
 * factories route files actually call, mounted, and sent a body that breaks
 * their rule. It asserts the request is refused AND the handler never ran.
 * This half deliberately depends on nothing but `createPublicRoute` /
 * `createProtectedRoute` / `createAdminRoute`, so it keeps working — and keeps
 * failing — if the internals are renamed, replaced, or bypassed. A guard
 * anchored on the name of the function that happens to do the work today would
 * go quietly green the day someone routes around it.
 *
 * **Half two — over the whole schema inventory.** Every refined object schema
 * `@repo/schemas` exports is pushed through the conversion and must come out
 * with the same number of object-level checks. Half one proves the current path
 * is sound for the shapes it names; half two is what catches a NEW refined
 * schema that lands on a branch which still drops them (the introspection
 * fallback, for one).
 *
 * **Route-local bodies count too.** Half two sweeps `@repo/schemas`, and two of
 * the sixteen refined request bodies in this app are declared inside their own
 * route file — which is exactly how the first inventory of this issue counted
 * ten instead of sixteen. Half three closes that: it reads the route tree, finds
 * every `requestBody:` whose schema is declared locally AND refined, and fails
 * unless that schema is exported, so half two can reach it.
 *
 * **Many declaration forms, not one.** A guard anchored on a single way of
 * spelling the schema lets the other five through, so the table below covers
 * `.refine`, `.superRefine`, `.check`, two stacked refinements, `.strict()` on
 * either side of the rule, a rule added to a `.omit()`-derived object, a rule
 * on a nested field object, and a refined schema that also carries
 * `z.coerce.*` — the one shape the factory hands over untouched.
 *
 * @module test/static-guards/refined-request-body-reaches-the-request
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as schemas from '@repo/schemas';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';
import { createOpenAPISchema } from '../../src/utils/openapi-schema';
import {
    createAdminRoute,
    createProtectedRoute,
    createPublicRoute
} from '../../src/utils/route-factory';
import { z } from '../../src/utils/zod';

const HEADERS = {
    'Content-Type': 'application/json',
    // `API_VALIDATION_REQUIRED_HEADERS` defaults to user-agent; without it the
    // request short-circuits with a 400 before routing and every case below
    // would "pass" without the schema being consulted at all.
    'user-agent': 'vitest'
};

const ACTOR = {
    id: '11111111-1111-4111-8111-111111111111',
    roles: ['ADMIN'],
    permissions: ['access.panelAdmin', 'access.apiAdmin']
};

/** Minimal concrete response schema; the factories refuse a permissive one. */
const RESPONSE_SCHEMA = z.object({ ok: z.boolean() });

/** The rule every fixture below expresses, in whatever syntax: `a` must be below `b`. */
const A_BELOW_B = (value: { a: number; b: number }) => value.a < value.b;

const BASE = z.object({ a: z.number(), b: z.number(), note: z.string().optional() });

/**
 * Each way a route file can spell a refined request body.
 *
 * They all encode the SAME rule so one violating body exercises every one of
 * them, which is what makes a form that quietly loses the rule visible as a
 * difference rather than as a different fixture.
 */
const DECLARATION_FORMS: ReadonlyArray<{ readonly form: string; readonly schema: z.ZodTypeAny }> = [
    { form: '.refine()', schema: BASE.refine(A_BELOW_B, { message: 'a<b', path: ['b'] }) },
    {
        form: '.superRefine()',
        schema: BASE.superRefine((value, ctx) => {
            if (!A_BELOW_B(value)) {
                ctx.addIssue({ code: 'custom', message: 'a<b', path: ['b'] });
            }
        })
    },
    {
        form: '.check()',
        schema: BASE.check((ctx) => {
            if (!A_BELOW_B(ctx.value)) {
                ctx.issues.push({ code: 'custom', message: 'a<b', input: ctx.value });
            }
        })
    },
    {
        form: 'two stacked refinements',
        schema: BASE.refine(() => true, 'always true').refine(A_BELOW_B, {
            message: 'a<b',
            path: ['b']
        })
    },
    {
        form: '.strict() before the rule',
        schema: BASE.strict().refine(A_BELOW_B, { message: 'a<b', path: ['b'] })
    },
    {
        form: 'derived with .omit() then refined',
        schema: BASE.extend({ dropMe: z.string().optional() })
            .omit({ dropMe: true })
            .refine(A_BELOW_B, { message: 'a<b', path: ['b'] })
    },
    {
        form: 'derived with .extend() then refined',
        schema: BASE.extend({ extra: z.string().optional() }).refine(A_BELOW_B, {
            message: 'a<b',
            path: ['b']
        })
    },
    {
        form: 'alongside a z.coerce field (factory escape hatch)',
        schema: z
            .object({ a: z.number(), b: z.number(), when: z.coerce.date().optional() })
            .refine(A_BELOW_B, { message: 'a<b', path: ['b'] })
    }
];

/**
 * A rule declared on a NESTED field object rather than on the body root.
 *
 * `convertDateField` recurses into nested objects through a second call, so
 * this form takes a different path through the conversion than every row above
 * and is the one a root-only fix would leave behind. It needs its own bodies
 * because the rule lives one level down.
 */
const NESTED_FORM = {
    form: 'a rule on a nested field object',
    schema: z.object({
        range: z.object({ a: z.number(), b: z.number() }).refine(A_BELOW_B, {
            message: 'a<b',
            path: ['b']
        })
    }),
    violating: { range: { a: 5, b: 1 } },
    valid: { range: { a: 1, b: 5 } }
} as const;

/** The body every root-level fixture must refuse: `a` is not below `b`. */
const VIOLATING_BODY = { a: 5, b: 1 };

/** The same body with the rule honoured, so a blanket-reject reads as a failure. */
const VALID_BODY = { a: 1, b: 5 };

/**
 * The three tier factories, each spelled the way route files spell it. The
 * refinement has to survive all of them; they funnel into one place today, and
 * this is what says so out loud if one ever stops.
 */
const FACTORIES = {
    public: createPublicRoute,
    protected: createProtectedRoute,
    admin: createAdminRoute
} as const;

/**
 * Mounts one route and posts a body to it.
 *
 * The actor is injected ahead of the route so the tier middlewares let the
 * request through to validation; an auth rejection would be a 401/403 and would
 * hide whether the body was ever examined.
 */
async function postTo(
    factory: (typeof FACTORIES)[keyof typeof FACTORIES],
    schema: z.ZodTypeAny,
    body: unknown
): Promise<{ readonly status: number; readonly handlerCalls: number }> {
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', ACTOR as never);
        return next();
    });
    app.route(
        '/',
        factory({
            method: 'post',
            path: '/',
            summary: 'guard fixture',
            description: 'A route built only to observe what the factory does to its body schema.',
            tags: ['Guard'],
            requestBody: schema,
            responseSchema: RESPONSE_SCHEMA,
            handler
        })
    );

    const response = await app.request('/', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body)
    });

    return { status: response.status, handlerCalls: handler.mock.calls.length };
}

describe('GUARD: a declared cross-field rule reaches the request (HOS-425)', () => {
    for (const [tier, factory] of Object.entries(FACTORIES)) {
        for (const { form, schema } of DECLARATION_FORMS) {
            it(`${tier} route declared with ${form} refuses a body that breaks the rule`, async () => {
                const { status, handlerCalls } = await postTo(factory, schema, VIOLATING_BODY);

                expect(status).toBe(400);
                // The status alone is not enough: a handler that ran and then
                // failed downstream could also produce a 4xx.
                expect(handlerCalls).toBe(0);
            });

            it(`${tier} route declared with ${form} still accepts a body that honours it`, async () => {
                const { status, handlerCalls } = await postTo(factory, schema, VALID_BODY);

                expect(status).toBe(201);
                expect(handlerCalls).toBe(1);
            });
        }

        it(`${tier} route declared with ${NESTED_FORM.form} refuses a body that breaks the rule`, async () => {
            const { status, handlerCalls } = await postTo(
                factory,
                NESTED_FORM.schema,
                NESTED_FORM.violating
            );

            expect(status).toBe(400);
            expect(handlerCalls).toBe(0);
        });

        it(`${tier} route declared with ${NESTED_FORM.form} still accepts a body that honours it`, async () => {
            const { status, handlerCalls } = await postTo(
                factory,
                NESTED_FORM.schema,
                NESTED_FORM.valid
            );

            expect(status).toBe(201);
            expect(handlerCalls).toBe(1);
        });
    }
});

/**
 * How many object-level checks a schema carries.
 *
 * Deliberately re-derived here from `_def` instead of importing the helper the
 * source uses: a guard that borrows the implementation's own predicate agrees
 * with it by construction, including when the predicate is what broke.
 */
function checkCount(schema: unknown): number {
    const checks = (schema as { _def?: { checks?: unknown } } | null | undefined)?._def?.checks;
    return Array.isArray(checks) ? checks.length : 0;
}

/** Every refined object schema the shared package exports, by export name. */
const REFINED_EXPORTS = Object.entries(schemas)
    .filter(([, value]) => value instanceof z.ZodObject && checkCount(value) > 0)
    .map(([name, value]) => ({ name, schema: value as z.ZodTypeAny }));

/** A request body schema declared in the route file that uses it. */
interface RouteLocalBody {
    readonly name: string;
    readonly decl: { readonly exported: boolean; readonly body: string };
    readonly file: string;
}

/**
 * True when a declaration applies `.refine` / `.superRefine` / `.check` at
 * CHAIN level — to the object itself, not to one of its fields.
 *
 * Only object-level rules are at risk: a `.refine()` on a field
 * (`z.string().refine(...)`) survives the rebuild untouched, because field
 * instances are copied across as-is.
 *
 * Decided by PAREN DEPTH, not by matching a shape like `}).superRefine(`. A
 * guard anchored on one spelling misses the others — the first attempt at this
 * check did exactly that, skipping the schema that writes `.strict()` between
 * the object and its rule. Depth is indifferent to formatting, to how many
 * chain calls sit in between, and to their order.
 */
function hasChainLevelRefinement(source: string): boolean {
    const CHAIN_CALL = /^\.(superRefine|refine|check)\s*\(/;
    let depth = 0;
    let quote: string | null = null;

    for (let i = 0; i < source.length; i++) {
        const ch = source[i] as string;

        if (quote !== null) {
            if (ch === '\\') {
                i++;
            } else if (ch === quote) {
                quote = null;
            }
            continue;
        }

        if (ch === "'" || ch === '"' || ch === '`') {
            quote = ch;
            continue;
        }

        if (ch === '(' || ch === '{' || ch === '[') {
            depth++;
        } else if (ch === ')' || ch === '}' || ch === ']') {
            depth--;
        } else if (ch === '.' && depth === 0 && CHAIN_CALL.test(source.slice(i))) {
            return true;
        }
    }

    return false;
}

/** Every `.ts` file under the routes tree, excluding tests. */
function routeFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            routeFiles(full, acc);
        } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
            acc.push(full);
        }
    }
    return acc;
}

const ROUTES_DIR = join(import.meta.dirname, '..', '..', 'src', 'routes');

/**
 * Request bodies declared inside a route file rather than imported.
 *
 * Found by source text, because that is the only way to see a schema the module
 * does not export — the very thing being guarded against. Comments are stripped
 * first so a commented-out example cannot register as a declaration.
 */
const ROUTE_LOCAL_BODIES = routeFiles(ROUTES_DIR).flatMap((file) => {
    const source = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

    const declared = new Map<string, { exported: boolean; body: string }>();
    for (const match of source.matchAll(
        /^(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=([\s\S]*?);\s*$/gm
    )) {
        declared.set(match[2] as string, {
            exported: Boolean(match[1]),
            body: match[3] as string
        });
    }

    const used = new Set(
        [...source.matchAll(/requestBody:\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1] as string)
    );

    return [...used]
        .map((name) => ({ name, decl: declared.get(name), file }))
        .filter(
            (row): row is RouteLocalBody =>
                row.decl !== undefined && hasChainLevelRefinement(row.decl.body)
        );
});

describe('GUARD: a refined request body declared inside a route file is reachable (HOS-425)', () => {
    it('finds the route-local refined bodies at all', () => {
        // If this drops to zero the two assertions below stop asserting, and
        // the blind spot that caused the original miscount is back.
        expect(ROUTE_LOCAL_BODIES.length).toBeGreaterThanOrEqual(2);
    });

    for (const { name, file } of ROUTE_LOCAL_BODIES) {
        it(`${name} is exported, so the inventory sweep can see it`, () => {
            const row = ROUTE_LOCAL_BODIES.find((candidate) => candidate.name === name);

            expect(
                row?.decl.exported,
                `${name} (${file}) declares a cross-field rule but is not exported, so no sweep ` +
                    'over the schema packages can check that the factory still enforces it. ' +
                    'Export it.'
            ).toBe(true);
        });
    }
});

describe('GUARD: no refined schema loses its rule in the OpenAPI conversion (HOS-425)', () => {
    it('finds a meaningful number of refined schemas to check', () => {
        // A sweep that silently matches nothing is the failure mode this guard
        // is most likely to die of — a renamed barrel, a changed export shape,
        // a Zod upgrade that moves `_def.checks`. Then every assertion below
        // passes over an empty list and the guard reports success forever.
        expect(REFINED_EXPORTS.length).toBeGreaterThanOrEqual(30);
    });

    for (const { name, schema } of REFINED_EXPORTS) {
        it(`${name} keeps its object-level checks`, () => {
            expect(checkCount(createOpenAPISchema(schema))).toBe(checkCount(schema));
        });
    }
});
