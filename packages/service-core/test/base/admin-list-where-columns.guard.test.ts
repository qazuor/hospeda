/**
 * HOS-1379 — `adminList` must never hand the model a `where` key its own table
 * does not have.
 *
 * ---------------------------------------------------------------------------
 * THE FAILURE THIS GUARD EXISTS FOR
 * ---------------------------------------------------------------------------
 * `adminList` built `where.lifecycleState = status` unconditionally, two lines
 * above a `'deletedAt' in tableRecord` check it DID perform. On a table without
 * that column the key reached `buildWhereClause`, which answers such a key in
 * one of two ways, neither of them visible to the caller:
 *
 *   - it DROPS the key (with a `dbLogger.warn`) and builds the clause from
 *     whatever is left — usually `deletedAt`. The request is answered with the
 *     whole table, paginated, looking filtered.
 *   - if nothing is left, it THROWS `DbError: All N key(s) in where clause were
 *     unknown columns`, which surfaces as a 500.
 *
 * Measured at branch point f4dff1acd, 2026-09-21: 47 concrete services, 20 of
 * them over a table with no `lifecycleState` column. Twelve of those twenty had
 * a reachable admin endpoint — a route that calls `adminList` and whose
 * `requestQuery` accepts `status` — so eleven answered `?status=ACTIVE` with an
 * unfiltered page and one, `GET /api/v1/admin/social/settings`, answered 500.
 *
 * ---------------------------------------------------------------------------
 * WHY A GUARD AND NOT A REVIEW HABIT
 * ---------------------------------------------------------------------------
 * Same reason as its sibling, `searchable-columns-fail-open.guard.test.ts`
 * (HOS-1117): the defect lives on a line nobody wrote for the entity it breaks.
 * `adminList` is inherited; a service that acquires a table without
 * `lifecycleState` produces no diff line at all. Two services had already
 * noticed INDEPENDENTLY and patched it LOCALLY — `EntityCommentService` stripped
 * the key afterwards (AC-17) and `HostTradeUsageService` moved it back into
 * `entityFilters` (T-038) — and neither patch told the other eighteen.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT ASSERTS, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------------
 * For every concrete `BaseCrudService` subclass in this package, and for every
 * `status` value that service's OWN `adminSearchSchema` accepts, `adminList` is
 * driven end to end with the model's read methods replaced by a capture. The
 * `where` that comes out — after any `_executeAdminSearch` override, after the
 * `entityFilters` merge, exactly what the model would have queried — is then
 * offered to the REAL `buildWhereClause` against the REAL Drizzle table, ONE
 * KEY AT A TIME. A key whose column does not exist is the lone key of its own
 * single-entry call, so `buildWhereClause` itself refuses it and the guard has
 * not had to restate its rule. A guard that reimplemented
 * `Object.hasOwn(table, key)` here would stop agreeing with the helper the
 * moment either side moved, and would keep reporting green.
 *
 * A service that answers the request with a 400 instead is compliant: refusing
 * a filter it cannot honour is the point. What this guard forbids is ANSWERING
 * — with a page, or with a 500 — while carrying a key the table does not have.
 *
 * It says nothing about whether a given entity's HTTP route exposes `?status=`.
 * `createListRoute` derives `allowedParams` from the route's own `requestQuery`,
 * so eight of the twenty measured above cannot be reached that way today (no
 * admin list route at all, a route that calls `list()` rather than `adminList`,
 * or a service with no `adminSearchSchema`). That makes their fix defensive
 * rather than urgent. It does not make the base correct, and a route gaining a
 * `requestQuery` later must not be what turns the bug on.
 *
 * This file runs in CI through the sharded `test-unit` job (`turbo run test`
 * reaches every `packages/*` vitest project). It is deliberately NOT wired into
 * `pnpm check:guards`: the `Guards` job runs no build, and this guard needs
 * `@repo/db` and `@repo/schemas` built because it instantiates real services.
 */

import { buildWhereClause } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Table } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { BaseCrudService } from '../../src/base/base.crud.service';
import type { Actor } from '../../src/types';

/**
 * `import.meta.glob` is Vite's, resolved at transform time; this package's
 * tsconfig does not pull in `vite/client`, so the one signature used here is
 * declared locally rather than widening the package's ambient types.
 */
declare global {
    interface ImportMeta {
        glob<TModule>(pattern: string, options: { eager: true }): Record<string, TModule>;
    }
}

// ---------------------------------------------------------------------------
// The entry point under watch
// ---------------------------------------------------------------------------

/**
 * The method this guard drives. Named once, and asserted to still exist on
 * `BaseCrudService` — a rename must break the guard loudly rather than leave it
 * reporting that every service is compliant.
 */
const ENTRY_POINT = 'adminList';

/**
 * The model reads `_executeAdminSearch` can end at, and the argument position
 * the `where` occupies in each.
 *
 * All of them are intercepted, because which one runs is a per-service
 * decision: the base picks between the first two on `getDefaultListRelations()`,
 * and `UserService`'s override ends at the third instead. Anchoring on one name
 * would silently skip every service that uses another — so a service that
 * reaches a FOURTH is not skipped either: the sweep fails on "succeeded without
 * reading the model", rather than passing on a clause it never saw.
 */
const MODEL_READS = {
    findAll: 0,
    findAllWithRelations: 1,
    findAllWithCounts: 0
} as const;

/**
 * Abstract bases with no table of their own. Listed by name on purpose: a
 * dedicated test asserts each is still present AND still un-inspectable, so
 * this cannot quietly become a hiding place for a concrete service.
 */
const ABSTRACT_BASES: readonly string[] = [
    'BaseCrudService',
    'BaseCrudRelatedService',
    'BaseCommerceListingService'
];

/**
 * Services whose `adminList` cannot be driven at all, each with the reason.
 *
 * These have no `adminSearchSchema`, so `adminList` answers
 * `CONFIGURATION_ERROR` before it builds any `where` — for EVERY request, not
 * just a filtered one. That is a real defect of its own and not this one; it is
 * recorded here so the set cannot grow unnoticed. An entry is honoured only
 * when the service really is un-drivable (see the test below), so nothing can
 * drift in by omission.
 */
const ADMIN_LIST_UNREACHABLE: ReadonlyArray<{
    readonly service: string;
    readonly reason: string;
}> = [
    {
        service: 'AlertSubscriptionService',
        reason: 'No adminSearchSchema, and no admin list route: price alerts are listed through the protected tier only.'
    },
    {
        service: 'ContentModerationTermService',
        reason: 'No adminSearchSchema, although GET /admin/content-moderation/terms does call adminList — so that endpoint answers CONFIGURATION_ERROR today, for every request.'
    },
    {
        service: 'ContentModerationThresholdService',
        reason: 'No adminSearchSchema, same as the terms endpoint above.'
    },
    {
        service: 'ExchangeRateService',
        reason: 'No adminSearchSchema, and no admin list route: exchange rates are read through the public tier and written by cron.'
    },
    {
        service: 'SponsorshipLevelService',
        reason: 'No adminSearchSchema; its admin route calls list(), not adminList().'
    },
    {
        service: 'SponsorshipPackageService',
        reason: 'No adminSearchSchema; its admin route calls list(), not adminList().'
    },
    {
        service: 'ExperienceReviewService',
        reason: 'No adminSearchSchema, although GET /admin/experiences/reviews does call adminList — so that endpoint answers CONFIGURATION_ERROR today, for every request.'
    },
    {
        service: 'GastronomyReviewService',
        reason: 'No adminSearchSchema; its admin reviews route calls listForModeration(), not adminList().'
    },
    {
        service: 'PointOfInterestCategoryService',
        reason: 'No adminSearchSchema; its admin route calls search(), and says so in a comment.'
    },
    {
        service: 'PostSponsorshipService',
        reason: 'No adminSearchSchema, and no admin route calls adminList on it.'
    },
    {
        service: 'UserBookmarkService',
        reason: 'No adminSearchSchema, and no admin route calls adminList on it: bookmarks are listed through the protected tier.'
    },
    {
        service: 'UserBookmarkCollectionService',
        reason: 'No adminSearchSchema, and no admin route calls adminList on it: collections are listed through the protected tier.'
    }
];

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** A CRUD service constructor, as reflection sees it. */
type ServiceClass = new (config: Record<string, unknown>) => unknown;

/** The members this guard reads off an instance. */
type Inspectable = {
    model?: Record<string, unknown> & { getTable?: () => unknown };
    adminSearchSchema?: { shape?: Record<string, unknown> };
};

/** One reason a run is not clean. */
type Finding = { readonly service: string; readonly problem: string };

/**
 * An actor that can pass any `_canAdminList`, including an override that checks
 * an entity-specific permission. Permission handling is not what is under test
 * here; a FORBIDDEN answer would make the sweep vacuous, so the sweep asserts
 * it never gets one.
 */
const omnipotentActor: Actor = {
    id: '00000000-0000-4000-8000-000000000001',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: Object.values(PermissionEnum) as PermissionEnum[]
};

/**
 * True when `value` is a class whose prototype chain reaches `BaseCrudService`.
 * Walking the chain (rather than matching `extends` in source) is what catches
 * a service that inherits through an intermediate class.
 */
const extendsBaseCrudService = (value: unknown): boolean => {
    if (typeof value !== 'function' || value === BaseCrudService) return false;
    let proto: unknown = Object.getPrototypeOf(value);
    while (typeof proto === 'function') {
        if (proto === BaseCrudService) return true;
        proto = Object.getPrototypeOf(proto);
    }
    return false;
};

/**
 * The `status` values one service's own admin search schema accepts, minus the
 * `'all'` sentinel, which by contract filters on nothing.
 *
 * Read off the schema rather than assumed, because `status` is a key entities
 * are allowed to REDEFINE: `HostTradeBenefitUsageAdminSearchSchema` replaces
 * the lifecycle enum with a usage state machine. Assuming
 * `DRAFT`/`ACTIVE`/`ARCHIVED` here would drive that service with values its own
 * schema rejects, and the guard would be measuring a request nobody can send.
 *
 * @throws when the field exists but yields no options — "this guard cannot see
 *   what it is meant to drive" must be an error and never a silent pass.
 */
const statusValuesOf = (service: string, field: unknown): readonly string[] => {
    const options = new Set<string>();
    const walk = (node: unknown, depth: number): void => {
        if (node === null || typeof node !== 'object' || depth > 8) return;
        const def = (node as { _def?: Record<string, unknown> })._def;
        if (def === undefined) return;
        const entries = def.entries ?? def.values;
        if (entries !== undefined && typeof entries === 'object') {
            for (const value of Object.values(entries as Record<string, unknown>)) {
                if (typeof value === 'string') options.add(value);
            }
        }
        if (Array.isArray(def.options)) {
            for (const option of def.options) walk(option, depth + 1);
        }
        // ZodDefault / ZodOptional / ZodNullable wrap the type that carries the
        // options, under `innerType` in every version this package has used.
        walk(def.innerType, depth + 1);
    };
    walk(field, 0);
    options.delete('all');
    if (options.size === 0) {
        throw new Error(
            `${service}: its adminSearchSchema declares "status" but this guard could not read a single value out of it. A status filter it cannot drive is a where key it cannot check; teach the reader the new shape rather than skipping the service.`
        );
    }
    return [...options];
};

/**
 * Offers `where` to the REAL `buildWhereClause`, one key at a time, and returns
 * the keys it refused.
 *
 * One key per call is what makes the helper itself answer the question: a key
 * whose column is missing is then the only key, which is exactly the case
 * `buildWhereClause` throws on. Nothing here restates its rule.
 */
const keysTheHelperRefuses = (where: Record<string, unknown>, table: Table): readonly string[] =>
    Object.entries(where)
        .filter(([, value]) => value !== undefined)
        .filter(([key, value]) => {
            try {
                buildWhereClause({ [key]: value }, table);
                return false;
            } catch {
                return true;
            }
        })
        .map(([key]) => key);

/**
 * Drives one service's `adminList` once per `status` value and reports every
 * `where` key the real helper refuses.
 *
 * The capture replaces the model's read methods, so the `where` inspected is
 * the one the model would have queried — after any `_executeAdminSearch`
 * override and after the `entityFilters` merge. Intercepting earlier would let
 * an override reintroduce a bad key behind the guard's back, which is precisely
 * the shape of the two local patches this change removed.
 */
const inspect = async (service: string, instance: object): Promise<readonly Finding[]> => {
    const inspectable = instance as Inspectable;
    const model = inspectable.model;
    if (typeof model?.getTable !== 'function') {
        throw new Error(
            `${service}: no model.getTable() to read a table from. A CRUD service this guard cannot inspect is a fail-open it cannot see; give it a model or list it in ABSTRACT_BASES.`
        );
    }
    const table = model.getTable.call(model) as Table;
    const schema = inspectable.adminSearchSchema;
    const statusField = schema?.shape?.status;
    if (schema === undefined) {
        // adminList answers CONFIGURATION_ERROR before building any where.
        // Reported by the dedicated test below, not swallowed here.
        return [];
    }

    const captured: Array<Record<string, unknown>> = [];
    for (const [read, whereArgIndex] of Object.entries(MODEL_READS)) {
        Object.defineProperty(model, read, {
            configurable: true,
            writable: true,
            value: (...args: unknown[]) => {
                captured.push((args[whereArgIndex] as Record<string, unknown>) ?? {});
                return Promise.resolve({ items: [], total: 0 });
            }
        });
    }

    const findings: Finding[] = [];
    const statuses =
        statusField === undefined
            ? ([] as readonly string[])
            : statusValuesOf(service, statusField);

    for (const status of statuses) {
        captured.length = 0;
        const result = await (
            instance as { adminList: (a: Actor, p: Record<string, unknown>) => Promise<unknown> }
        )[ENTRY_POINT](omnipotentActor, {
            page: 1,
            pageSize: 20,
            sort: 'createdAt:desc',
            status,
            includeDeleted: false
        });

        const error = (result as { error?: { code?: string; message?: string } }).error;
        if (error?.code === 'FORBIDDEN') {
            throw new Error(
                `${service}: adminList answered FORBIDDEN to an actor holding every permission. The sweep cannot reach the where clause, so a clean run would mean nothing.`
            );
        }
        if (error?.code === 'VALIDATION_ERROR') {
            // Refusing a filter the entity cannot honour is the compliant
            // answer, and it means no where was built at all.
            continue;
        }
        if (error !== undefined) {
            findings.push({
                service,
                problem: `adminList(status: "${status}") answered ${error.code}: ${error.message}. This guard can only certify a service whose admin list it can drive.`
            });
            continue;
        }
        if (captured.length === 0) {
            findings.push({
                service,
                problem: `adminList(status: "${status}") succeeded without reading the model through ${Object.keys(MODEL_READS).join(' or ')}. The where clause this guard exists to inspect went somewhere it cannot see.`
            });
            continue;
        }
        for (const where of captured) {
            const refused = keysTheHelperRefuses(where, table);
            if (refused.length > 0) {
                findings.push({
                    service,
                    problem: `adminList(status: "${status}") handed the model [${refused.join(', ')}], and buildWhereClause refuses ${refused.length === 1 ? 'that key' : 'those keys'} against this entity's own table. Depending on what else is in the clause it is dropped — answering an unfiltered page that looks filtered — or it is the only key left, and the request answers 500.`
                });
            }
        }
    }

    return findings;
};

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const modules = import.meta.glob<Record<string, unknown>>('../../src/**/*.ts', { eager: true });

const discovered = new Map<string, ServiceClass>();
for (const module of Object.values(modules)) {
    for (const [name, value] of Object.entries(module)) {
        if (extendsBaseCrudService(value) && !discovered.has(name)) {
            discovered.set(name, value as ServiceClass);
        }
    }
}

const concrete = [...discovered].filter(([name]) => !ABSTRACT_BASES.includes(name));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HOS-1379: adminList never builds a where key the table lacks', () => {
    it(`BaseCrudService still exposes ${ENTRY_POINT}()`, () => {
        // If this fails the entry point was renamed or removed, and the guard is
        // blind. It must then be updated, not deleted.
        expect(typeof Reflect.get(BaseCrudService.prototype, ENTRY_POINT)).toBe('function');
    });

    it('finds the CRUD services of this package', () => {
        // A discovery that silently returns nothing — or a barrel regression
        // dropping a folder of services — would make the sweep vacuous without
        // failing anything. The floor sits just under the measured 47.
        expect(concrete.length).toBeGreaterThanOrEqual(45);
        expect(discovered.has('AccommodationService')).toBe(true);
    });

    it('every class kept out of the sweep is still an un-inspectable base', () => {
        for (const name of ABSTRACT_BASES) {
            if (name === 'BaseCrudService') continue;
            const Cls = discovered.get(name);
            expect(Cls, `${name} is listed in ABSTRACT_BASES but no longer exists`).toBeDefined();
            let inspectable = false;
            try {
                const instance = (new (Cls as ServiceClass)({}) as Inspectable) ?? {};
                inspectable = typeof instance.model?.getTable === 'function';
            } catch {
                inspectable = false;
            }
            expect(
                inspectable,
                `${name} now has a real model — it is a concrete service and must not be skipped`
            ).toBe(false);
        }
    });

    it('the services listed as un-drivable really have no adminSearchSchema, and no others do', () => {
        // Read in BOTH directions: an entry whose service gained a schema is
        // stale and must go, and a service that lost one must not slip in
        // silently — for it, adminList answers CONFIGURATION_ERROR to EVERY
        // request, filtered or not.
        const listed = new Set(ADMIN_LIST_UNREACHABLE.map((entry) => entry.service));
        const problems: string[] = [];

        for (const [name, Cls] of concrete) {
            let hasSchema = false;
            try {
                hasSchema = (new Cls({}) as Inspectable).adminSearchSchema !== undefined;
            } catch {
                hasSchema = true; // constructor trouble is not this test's subject
            }
            if (!hasSchema && !listed.has(name)) {
                problems.push(
                    `${name} has no adminSearchSchema, so adminList answers CONFIGURATION_ERROR for every request. Give it one, or list it in ADMIN_LIST_UNREACHABLE with the reason.`
                );
            }
            if (hasSchema && listed.has(name)) {
                problems.push(
                    `${name} is listed in ADMIN_LIST_UNREACHABLE but now HAS an adminSearchSchema. Remove the stale entry so the sweep covers it.`
                );
            }
        }
        for (const entry of ADMIN_LIST_UNREACHABLE) {
            if (!discovered.has(entry.service)) {
                problems.push(
                    `${entry.service} is listed in ADMIN_LIST_UNREACHABLE but no such CRUD service was found. Remove the entry or fix the name.`
                );
            }
        }

        expect(problems.join('\n')).toBe('');
    });

    describe('trap cases: the predicate can fail', () => {
        // REAL Drizzle tables, so `buildWhereClause` runs against the same kind
        // of object it sees in production rather than a stand-in that could
        // agree with the guard while disagreeing with the helper.
        const trapTable = pgTable('hos_1379_guard_trap', {
            id: uuid('id').primaryKey(),
            label: text('label').notNull(),
            deletedAt: timestamp('deleted_at')
        });

        it('reports the fail-open shape: an unknown key alongside a known one', () => {
            expect(
                keysTheHelperRefuses({ lifecycleState: 'ACTIVE', deletedAt: null }, trapTable)
            ).toEqual(['lifecycleState']);
        });

        it('reports the 500 shape: an unknown key on its own', () => {
            expect(keysTheHelperRefuses({ lifecycleState: 'ACTIVE' }, trapTable)).toEqual([
                'lifecycleState'
            ]);
        });

        it('clears a where whose every key is a real column, suffixes included', () => {
            expect(
                keysTheHelperRefuses(
                    { label: 'x', deletedAt: null, id_gte: '00000000-0000-4000-8000-000000000000' },
                    trapTable
                )
            ).toEqual([]);
        });

        it('ignores undefined values, which buildWhereClause drops before building anything', () => {
            expect(keysTheHelperRefuses({ label: undefined, deletedAt: null }, trapTable)).toEqual(
                []
            );
        });

        it('reads status values out of a schema that REDEFINED the field', () => {
            const redefined = {
                _def: { innerType: { _def: { entries: { A: 'PENDING', B: 'CONFIRMED' } } } }
            };
            expect([...statusValuesOf('TrapService', redefined)].sort()).toEqual([
                'CONFIRMED',
                'PENDING'
            ]);
        });

        it('refuses a status field it cannot read, instead of skipping the service', () => {
            expect(() => statusValuesOf('OpaqueService', { _def: {} })).toThrow(
                /could not read a single value out of it/
            );
        });
    });

    it('no service in this package hands the model a key its own table lacks', async () => {
        const findings: Finding[] = [];
        for (const [name, Cls] of concrete) {
            findings.push(...(await inspect(name, new Cls({}) as object)));
        }

        expect(
            findings.map((finding) => `${finding.service}: ${finding.problem}`).join('\n\n')
        ).toBe('');
    });
});
