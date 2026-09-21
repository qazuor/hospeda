/**
 * HOS-1117 — admin free-text search must never fail open.
 *
 * ---------------------------------------------------------------------------
 * THE FAILURE THIS GUARD EXISTS FOR
 * ---------------------------------------------------------------------------
 * `BaseCrudService.getSearchableColumns()` returns `['name']` by default
 * (`src/base/base.crud.permissions.ts`). A service whose table has no `name`
 * column and that does not override the hook inherits that default, and the
 * chain below fails OPEN rather than closed:
 *
 *   1. `adminList` calls `buildSearchCondition(search, ['name'], table)`.
 *   2. `buildSearchCondition` keeps only the columns that actually exist on the
 *      table (`Object.hasOwn`) — here, none.
 *   3. With zero conditions it returns `undefined`.
 *   4. `_executeAdminSearch` receives `undefined` and adds NO condition to the
 *      where clause.
 *
 * A search term that reaches that path is therefore answered with the WHOLE
 * table, paginated. No error, no warning, no log. For an operator that is worse
 * than a failure: the list looks full and normal, so they may pick the wrong
 * record believing it was filtered.
 *
 * The hook has exactly two call sites, `list()` (line 295) and `adminList()`
 * (line 535) — NOT `search()` or `count()`, which build their conditions
 * elsewhere. Whether a given entity's HTTP route exposes `?search=` at all is a
 * separate question this guard does not ask: `createListRoute` derives
 * `allowedParams` from `PaginationQuerySchema` plus the route's own
 * `requestQuery`, so a route that declares no `requestQuery` answers `?search=`
 * with a 400 rather than an unfiltered list. Five of the thirteen services
 * fixed alongside this guard are in that position today. That makes their fix
 * defensive rather than urgent — it does not make the hook correct, and a route
 * gaining a `requestQuery` later must not be what turns the search on.
 *
 * ---------------------------------------------------------------------------
 * WHY A GUARD AND NOT A REVIEW HABIT
 * ---------------------------------------------------------------------------
 * The defect lives on a line NOBODY WROTE. Reviewing a diff means reading the
 * lines that are there; an inherited hook that was never overridden produces
 * none. It was found by accident on PR #3173 (HOS-981), where the schema file
 * even carried a comment saying "the service uses the base class default" —
 * which is precisely what stops the next reader from checking.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT ASSERTS
 * ---------------------------------------------------------------------------
 * For every concrete subclass of `BaseCrudService` in this package: EVERY
 * column `getSearchableColumns()` returns exists on the table its own model
 * points at. The decisive check is `buildSearchCondition` itself, called with
 * the real Drizzle table object — not an approximation of it, and not a match
 * on source text.
 *
 * Note the "every", not "at least one". One valid column is enough for
 * `buildSearchCondition` to return a condition, so a service that names
 * `['slug', 'nombre']` passes that test while `nombre` is dropped silently and
 * forever — the operator believes the search covers two fields and it covers
 * one. That is the same failure one level down, so it is reported too.
 *
 * ---------------------------------------------------------------------------
 * MEASURED BEFORE IT WAS WRITTEN (2026-09-21, branch point 60a39dae2)
 * ---------------------------------------------------------------------------
 * 49 subclasses discovered, 2 of them the abstract bases listed in
 * `ABSTRACT_BASES`, so 47 concrete services inspected — 13 failing open. Ten were given real
 * columns in the same change; the three in `DECLARED_EXCEPTIONS` below are
 * entities where free-text search has nothing to match, and they are required
 * to say so EXPLICITLY — an exception is honoured only when the service itself
 * returns an empty list. An inherited `['name']` never qualifies, so nothing
 * can drift into the exception list by omission.
 *
 * This file runs in CI through the sharded `test-unit` job (`turbo run test`
 * reaches every `packages/*` vitest project; this package's config includes
 * `test/**\/*.test.ts`). It is NOT wired into `pnpm check:guards`: the `Guards`
 * CI job runs no build, and this guard needs `@repo/db` and `@repo/schemas`
 * built because it instantiates the real services.
 */

import { buildSearchCondition } from '@repo/db';
import type { Table } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { BaseCrudService } from '../../src/base/base.crud.service';

/**
 * `import.meta.glob` is Vite's, resolved at transform time. This package's
 * tsconfig type-checks `test/**` but does not pull in `vite/client`, so the
 * one signature used here is declared locally rather than widening the whole
 * package's ambient types for a single call.
 */
declare global {
    interface ImportMeta {
        glob<TModule>(pattern: string, options: { eager: true }): Record<string, TModule>;
    }
}

// ---------------------------------------------------------------------------
// The hook under watch
// ---------------------------------------------------------------------------

/**
 * The name of the hook this guard polices. It is used to detect an override, so
 * a rename would make the guard blind — that is what the first test below is
 * for: it fails loudly if the hook is no longer on `BaseCrudService` under this
 * name, instead of quietly reporting that every service is compliant.
 */
const HOOK = 'getSearchableColumns';

/**
 * Abstract bases that carry no table of their own. Listed by name on purpose:
 * a dedicated test asserts each one is still present AND still un-inspectable,
 * so this cannot quietly become a hiding place for a concrete service.
 */
const ABSTRACT_BASES: readonly string[] = [
    'BaseCrudService',
    'BaseCrudRelatedService',
    'BaseCommerceListingService'
];

/**
 * Services allowed to resolve zero searchable columns, each with the reason.
 *
 * An entry only takes effect when the service ALSO returns an empty list of its
 * own accord (see `evaluate`). Two conditions, both inspectable, and neither is
 * satisfied by inheriting the default.
 */
const DECLARED_EXCEPTIONS: ReadonlyArray<{ readonly service: string; readonly reason: string }> = [
    {
        service: 'AlertSubscriptionService',
        reason: 'tourist_price_alerts has no text column at all: id, userId, accommodationId, basePriceSnapshot, targetPercentDrop, isActive and the three timestamps. There is nothing for a free-text term to match.'
    },
    {
        service: 'ExchangeRateService',
        reason: 'exchange_rates has no text column at all: a uuid, four Postgres enums (fromCurrency, toCurrency, rateType, source), two numerics, a boolean and four timestamps. Free-text search has no surface here.'
    },
    {
        service: 'HostTradeUsageService',
        reason: 'Deliberate and pre-existing: the benefit-usage admin list filters on typed columns (declarant, state, date range). The two free-text columns it does have (note, rejectionNote) are moderation notes, not identifiers.'
    }
];

// ---------------------------------------------------------------------------
// Primitives — each one small enough to be fed a fixture
// ---------------------------------------------------------------------------

/** A CRUD service constructor, as reflection sees it. */
type ServiceClass = new (config: Record<string, unknown>) => unknown;

/** The two members this guard reads off an instance. */
type Inspectable = {
    readonly model?: { readonly getTable?: () => unknown };
    readonly [HOOK]?: () => readonly string[];
};

/** What one service looks like to the predicate. */
type Inspection = {
    readonly service: string;
    readonly columns: readonly string[];
    readonly usableColumns: readonly string[];
    readonly declaresHook: boolean;
    /** `true` when the real `buildSearchCondition` produced no condition at all. */
    readonly failsOpen: boolean;
};

/**
 * The term fed to `buildSearchCondition`. Its value is irrelevant — only
 * whether a condition comes back at all is — but it must be non-blank, because
 * the helper short-circuits on an empty term for an unrelated reason.
 */
const PROBE_TERM = 'hos-1117-probe';

/**
 * True when `value` is a class whose prototype chain reaches `BaseCrudService`.
 *
 * Walking the chain (rather than matching `extends BaseCrudService` in source)
 * is what catches a service that inherits through an intermediate class.
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
 * True when the hook is redefined anywhere between the instance and
 * `BaseCrudService.prototype`.
 *
 * Checking own-property presence at every level covers all the shapes a
 * redefinition can take — `protected override` method, plain method shorthand,
 * an arrow property assigned in the constructor (own property on the instance),
 * and a definition on an intermediate class — without naming any of them.
 */
const declaresHook = (instance: object): boolean => {
    if (Object.hasOwn(instance, HOOK)) return true;
    let proto: object | null = Object.getPrototypeOf(instance);
    while (proto !== null && proto !== BaseCrudService.prototype) {
        if (Object.hasOwn(proto, HOOK)) return true;
        proto = Object.getPrototypeOf(proto);
    }
    return false;
};

/**
 * Reads one service instance and asks the REAL `buildSearchCondition` what it
 * would do with it.
 *
 * Calling the production helper — rather than re-deriving its
 * `Object.hasOwn(table, column)` rule here — is deliberate: a guard that
 * reimplements the predicate it polices stops agreeing with it the moment
 * either side moves, and would keep reporting green while `adminList` started
 * dropping conditions for some new reason. `usableColumns` is kept alongside,
 * but only to make the failure message say WHICH columns were dropped.
 *
 * @throws when the instance has no usable model, or no hook under {@link HOOK} —
 *   both are "this guard cannot see what it is meant to police", which must be
 *   an error and never a silent pass.
 */
const inspectInstance = (service: string, instance: object): Inspection => {
    const inspectable = instance as Inspectable;
    const getTable = inspectable.model?.getTable;
    if (typeof getTable !== 'function') {
        throw new Error(
            `${service}: no model.getTable() to read a table from. A CRUD service that this guard cannot inspect is a fail-open it cannot see; give it a model or list it in ABSTRACT_BASES.`
        );
    }
    const hook = inspectable[HOOK];
    if (typeof hook !== 'function') {
        throw new Error(
            `${service}: has no ${HOOK}(). If the hook was renamed, this guard must be renamed with it — deleting it would leave admin search failing open unobserved.`
        );
    }
    const tableValue = getTable.call(inspectable.model);
    const table = tableValue as Table;
    const tableRecord = tableValue as Record<string, unknown>;
    const columns = hook.call(instance);
    return {
        service,
        columns,
        usableColumns: columns.filter((column) => Object.hasOwn(tableRecord, column)),
        declaresHook: declaresHook(instance),
        failsOpen: buildSearchCondition(PROBE_TERM, columns, table) === undefined
    };
};

/** One reason a run is not clean. */
type Finding = { readonly service: string; readonly problem: string };

/**
 * The predicate, in one place and free of I/O.
 *
 * Reads the exception list in BOTH directions: a service failing open without
 * an entry is a violation, and an entry whose service no longer fails open is a
 * stale exception. A one-directional check would let the list outlive its
 * subject and quietly exempt a service that had been fixed.
 */
const evaluate = (
    inspections: readonly Inspection[],
    exceptions: ReadonlyArray<{ readonly service: string; readonly reason: string }>
): readonly Finding[] => {
    const excepted = new Map(exceptions.map((entry) => [entry.service, entry.reason]));
    const findings: Finding[] = [];

    for (const inspection of inspections) {
        const failsOpen = inspection.failsOpen;
        const isExcepted = excepted.has(inspection.service);

        if (failsOpen) {
            if (!isExcepted) {
                findings.push({
                    service: inspection.service,
                    problem: `resolves NO searchable column against its own table (${HOOK}() returned [${inspection.columns.join(', ')}]${
                        inspection.declaresHook ? '' : ', inherited from BaseCrudService'
                    }). Any search term that reaches list() or adminList() would apply no filter at all. Override ${HOOK}() with columns that exist, or declare the exception.`
                });
                continue;
            }
            if (!inspection.declaresHook) {
                findings.push({
                    service: inspection.service,
                    problem: `is a declared exception but never says so in code: it INHERITS ${HOOK}() from BaseCrudService. A declared exception must override ${HOOK}() and return [] explicitly, so the absence of a search surface is a decision and not an omission.`
                });
            }
            continue;
        }

        if (isExcepted) {
            findings.push({
                service: inspection.service,
                problem: `is listed in DECLARED_EXCEPTIONS but no longer fails open (it resolves [${inspection.usableColumns.join(', ')}]). Remove the stale entry — an exception that outlives its subject exempts a service nobody meant to exempt.`
            });
            continue;
        }

        // One valid column is enough for `buildSearchCondition` to return a
        // condition, so a PARTIAL typo hides inside a passing service: the
        // misspelled column is dropped silently and forever, and an operator
        // reading the hook believes the search covers a field it never touches.
        // Same failure mode as the one above, one level down.
        const dropped = inspection.columns.filter(
            (column) => !inspection.usableColumns.includes(column)
        );
        if (dropped.length > 0) {
            findings.push({
                service: inspection.service,
                problem: `names [${dropped.join(', ')}] in ${HOOK}(), and no such column exists on its own table. buildSearchCondition drops unknown columns silently, so the search matches only [${inspection.usableColumns.join(', ')}] while the hook claims more.`
            });
        }
    }

    for (const entry of exceptions) {
        if (!inspections.some((inspection) => inspection.service === entry.service)) {
            findings.push({
                service: entry.service,
                problem:
                    'is listed in DECLARED_EXCEPTIONS but no such CRUD service was found. Remove the entry or fix the name.'
            });
        }
    }

    return findings;
};

// ---------------------------------------------------------------------------
// Discovery — every module of this package, so nothing hides in a folder
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

describe('HOS-1117: admin search never resolves to zero columns', () => {
    it(`BaseCrudService still inherits ${HOOK}() with the default this guard was built against`, () => {
        // If this fails, the hook was renamed or removed. The guard is then
        // blind and must be updated — not deleted.
        //
        // The declaration sits on one of the mixin classes BaseCrudService is
        // composed from (BaseCrudPermissions today), not on BaseCrudService
        // itself, so the walk starts at its prototype and goes up. That is also
        // why `declaresHook` uses BaseCrudService.prototype as its stop line:
        // anything at or above it is "not overridden".
        let proto: object | null = BaseCrudService.prototype;
        let declaredOn: string | null = null;
        while (proto !== null) {
            if (Object.hasOwn(proto, HOOK)) {
                declaredOn = proto.constructor?.name ?? 'unknown';
                break;
            }
            proto = Object.getPrototypeOf(proto);
        }
        expect(declaredOn, `${HOOK}() is no longer declared anywhere on the base chain`).not.toBe(
            null
        );
        const inherited = Reflect.get(BaseCrudService.prototype, HOOK) as
            | (() => readonly string[])
            | undefined;
        expect(inherited?.()).toEqual(['name']);
    });

    it('finds the CRUD services of this package', () => {
        // A discovery that silently returns nothing — or a barrel regression
        // that drops a folder of services — would make the sweep below vacuous
        // without failing anything. The floor sits just under the measured 47
        // so that losing more than a couple of services is caught, not excused.
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

    describe('trap cases: the predicate can fail', () => {
        // A REAL Drizzle table, so `buildSearchCondition` runs against the same
        // kind of object it sees in production rather than a stand-in that
        // could agree with the guard while disagreeing with the helper.
        const tableWithoutName = pgTable('hos_1117_trap', {
            id: uuid('id').primaryKey(),
            label: text('label').notNull(),
            slug: text('slug').notNull()
        });
        const makeInstance = (proto: object): object => {
            const instance = Object.create(proto) as Record<string, unknown>;
            instance.model = { getTable: () => tableWithoutName };
            return instance;
        };

        it('reports a service over a name-less table that inherits the default', () => {
            const trap = makeInstance(Object.create(BaseCrudService.prototype));
            const inspection = inspectInstance('TrapService', trap);

            expect(inspection.columns).toEqual(['name']);
            expect(inspection.usableColumns).toEqual([]);
            expect(inspection.declaresHook).toBe(false);
            expect(evaluate([inspection], [])).toHaveLength(1);
            expect(evaluate([inspection], [])[0]?.problem).toContain('no filter at all');
        });

        it('clears the same service once it overrides the hook with a real column', () => {
            const proto = Object.create(BaseCrudService.prototype) as Record<string, unknown>;
            proto[HOOK] = () => ['label'];
            const inspection = inspectInstance('FixedService', makeInstance(proto));

            expect(inspection.usableColumns).toEqual(['label']);
            expect(inspection.declaresHook).toBe(true);
            expect(evaluate([inspection], [])).toEqual([]);
        });

        it('still reports an override that names a column the table does not have', () => {
            const proto = Object.create(BaseCrudService.prototype) as Record<string, unknown>;
            proto[HOOK] = () => ['titel'];
            const inspection = inspectInstance('TypoService', makeInstance(proto));

            expect(inspection.declaresHook).toBe(true);
            expect(evaluate([inspection], [])).toHaveLength(1);
        });

        it('reports a PARTIAL typo, which buildSearchCondition alone would pass', () => {
            const proto = Object.create(BaseCrudService.prototype) as Record<string, unknown>;
            proto[HOOK] = () => ['slug', 'nombre'];
            const inspection = inspectInstance('HalfTypoService', makeInstance(proto));

            // One good column is enough for the helper to build a condition, so
            // the fail-open check alone sees nothing wrong here.
            expect(inspection.failsOpen).toBe(false);
            expect(inspection.usableColumns).toEqual(['slug']);

            const findings = evaluate([inspection], []);
            expect(findings).toHaveLength(1);
            expect(findings[0]?.problem).toContain('nombre');
            expect(findings[0]?.problem).toContain('drops unknown columns silently');
        });

        it('honours a declared exception only when the service returns [] itself', () => {
            const exceptions = [{ service: 'QuietService', reason: 'no text column at all' }];

            const inherited = inspectInstance(
                'QuietService',
                makeInstance(Object.create(BaseCrudService.prototype))
            );
            expect(evaluate([inherited], exceptions)[0]?.problem).toContain(
                'never says so in code'
            );

            const proto = Object.create(BaseCrudService.prototype) as Record<string, unknown>;
            proto[HOOK] = () => [];
            const declared = inspectInstance('QuietService', makeInstance(proto));
            expect(evaluate([declared], exceptions)).toEqual([]);
        });

        it('reports a stale exception whose service no longer fails open', () => {
            const proto = Object.create(BaseCrudService.prototype) as Record<string, unknown>;
            proto[HOOK] = () => ['label'];
            const inspection = inspectInstance('FixedService', makeInstance(proto));
            const findings = evaluate(
                [inspection],
                [{ service: 'FixedService', reason: 'obsolete' }]
            );

            expect(findings).toHaveLength(1);
            expect(findings[0]?.problem).toContain('stale entry');
        });

        it('reports an exception that names no service at all', () => {
            const findings = evaluate([], [{ service: 'GhostService', reason: 'typo' }]);
            expect(findings).toHaveLength(1);
            expect(findings[0]?.problem).toContain('no such CRUD service');
        });

        it('refuses to inspect a service whose hook is gone', () => {
            const proto = Object.create(BaseCrudService.prototype) as Record<string, unknown>;
            proto[HOOK] = undefined;
            expect(() => inspectInstance('RenamedHookService', makeInstance(proto))).toThrow(
                /has no getSearchableColumns/
            );
        });
    });

    it('no service in this package resolves zero searchable columns', () => {
        const inspections = concrete.map(([name, Cls]) =>
            inspectInstance(name, new Cls({}) as object)
        );
        const findings = evaluate(inspections, DECLARED_EXCEPTIONS);

        expect(
            findings.map((finding) => `${finding.service} ${finding.problem}`).join('\n\n')
        ).toBe('');
    });
});
