/**
 * @fileoverview
 * Tests for the data-migration context factory (HOS-25, T-005):
 * {@link buildMigrationContext}.
 *
 * Fully mocked — no live database connection required:
 *
 * - `loadSuperAdminAndGetActor` (`../../src/utils/superAdminLoader.js`) is
 *   DB-dependent (excluded from coverage per `vitest.config.ts`'s DB-only
 *   exclusion list) and is mocked here so the "no actor injected" bootstrap
 *   path is exercised without a real super-admin lookup.
 * - `safeDelete` (`../../src/data-migrations/helpers/safeDelete.js`) is
 *   mocked so this file can assert the context factory injects `db` into
 *   every call, without re-exercising the real FK-guard/operator-edit logic
 *   (already covered by `safeDelete.test.ts`).
 *
 * Both mock factories reference their spies via `vi.hoisted()` — `vi.mock()`
 * calls are hoisted above all imports/top-level `const`s by Vitest, so a
 * plain `const spy = vi.fn()` referenced inside a `vi.mock()` factory would
 * hit a temporal-dead-zone error; `vi.hoisted()` is the documented fix.
 *
 * `ctx.models`/`ctx.services` are asserted via a KEY-COUNT/shape check rather
 * than referential identity against a separately-imported copy of the same
 * barrel, or individual symbol presence (e.g. `ctx.models.UserModel`).
 * Empirically, two independent `import * as X from '@repo/db'` statements
 * (one in `context.ts`, one that would live in this test file) do NOT
 * resolve to the same object reference under Vitest's Vite-based SSR module
 * runner here (verified while authoring this test — `toBe` failed with
 * near-identical-but-not-equal namespace objects). Sibling test files in
 * this package (`ledger.test.ts`, `systemUser.seed.test.ts`) separately
 * document that specific deeply-indirected `export *` chain symbols can
 * also intermittently resolve to `undefined` under the same runner. A
 * large, stable key COUNT is robust against both quirks: an occasional
 * individual key resolving to `undefined` still leaves the key present
 * (`Object.keys` is unaffected), and this assertion never depends on a
 * second import of the same module resolving to the identical reference.
 */
import type { DrizzleClient } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { SQL, Table } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadSuperAdminAndGetActorMock, safeDeleteMock } = vi.hoisted(() => ({
    loadSuperAdminAndGetActorMock: vi.fn(),
    safeDeleteMock: vi.fn()
}));

vi.mock('../../src/utils/superAdminLoader.js', () => ({
    loadSuperAdminAndGetActor: loadSuperAdminAndGetActorMock
}));

vi.mock('../../src/data-migrations/helpers/safeDelete.js', () => ({
    safeDelete: safeDeleteMock
}));

import { buildMigrationContext } from '../../src/data-migrations/context.js';

/** Stand-in Drizzle client — the factory only passes this through / closes over it, never calls methods on it. */
const STUB_DB = { __marker: 'stub-db' } as unknown as DrizzleClient;

const STUB_ACTOR: Actor = {
    id: 'actor-stub-id',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

const STUB_TABLE = { __marker: 'stub-table' } as unknown as Table;
const STUB_WHERE = { __marker: 'stub-where' } as unknown as SQL;

describe('buildMigrationContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass the given db through unchanged as ctx.db', async () => {
        loadSuperAdminAndGetActorMock.mockResolvedValue(STUB_ACTOR);

        const ctx = await buildMigrationContext({ db: STUB_DB });

        expect(ctx.db).toBe(STUB_DB);
    });

    it('should use the injected actor without bootstrapping a super-admin', async () => {
        const ctx = await buildMigrationContext({ db: STUB_DB, actor: STUB_ACTOR });

        expect(ctx.actor).toBe(STUB_ACTOR);
        expect(loadSuperAdminAndGetActorMock).not.toHaveBeenCalled();
    });

    it('should bootstrap the super-admin actor when none is injected', async () => {
        loadSuperAdminAndGetActorMock.mockResolvedValue(STUB_ACTOR);

        const ctx = await buildMigrationContext({ db: STUB_DB });

        expect(ctx.actor).toBe(STUB_ACTOR);
        expect(loadSuperAdminAndGetActorMock).toHaveBeenCalledOnce();
    });

    it('should expose the full @repo/db barrel as ctx.models', async () => {
        loadSuperAdminAndGetActorMock.mockResolvedValue(STUB_ACTOR);

        const ctx = await buildMigrationContext({ db: STUB_DB });

        expect(ctx.models).toBeTypeOf('object');
        // @repo/db exports 90+ model classes alone (plus schemas, drizzle
        // helpers, etc.) as of HOS-25 T-005 — a large margin above 50 proves
        // this is the real barrel, not an empty/placeholder object.
        expect(Object.keys(ctx.models).length).toBeGreaterThan(50);
    });

    it('should expose the full @repo/service-core barrel as ctx.services', async () => {
        loadSuperAdminAndGetActorMock.mockResolvedValue(STUB_ACTOR);

        const ctx = await buildMigrationContext({ db: STUB_DB });

        expect(ctx.services).toBeTypeOf('object');
        // @repo/service-core exports 80+ service classes alone as of HOS-25
        // T-005 — same large-margin rationale as the ctx.models assertion.
        expect(Object.keys(ctx.services).length).toBeGreaterThan(50);
    });

    it('should forward ctx.helpers.safeDelete calls to the real safeDelete with the closed-over db injected', async () => {
        loadSuperAdminAndGetActorMock.mockResolvedValue(STUB_ACTOR);
        safeDeleteMock.mockResolvedValue({ deleted: true });

        const ctx = await buildMigrationContext({ db: STUB_DB });
        const result = await ctx.helpers.safeDelete({
            table: STUB_TABLE,
            where: STUB_WHERE,
            reason: 'test reason'
        });

        expect(safeDeleteMock).toHaveBeenCalledExactlyOnceWith({
            db: STUB_DB,
            table: STUB_TABLE,
            where: STUB_WHERE,
            reason: 'test reason'
        });
        expect(result).toEqual({ deleted: true });
    });

    it('should forward an isOperatorEdited predicate through to safeDelete when supplied', async () => {
        loadSuperAdminAndGetActorMock.mockResolvedValue(STUB_ACTOR);
        safeDeleteMock.mockResolvedValue({
            deleted: false,
            skipped: true,
            reason: 'operator-edited'
        });

        const isOperatorEdited = vi.fn().mockReturnValue(true);
        const ctx = await buildMigrationContext({ db: STUB_DB });
        const result = await ctx.helpers.safeDelete({
            table: STUB_TABLE,
            where: STUB_WHERE,
            reason: 'test reason',
            isOperatorEdited
        });

        expect(safeDeleteMock).toHaveBeenCalledExactlyOnceWith({
            db: STUB_DB,
            table: STUB_TABLE,
            where: STUB_WHERE,
            reason: 'test reason',
            isOperatorEdited
        });
        expect(result).toEqual({ deleted: false, skipped: true, reason: 'operator-edited' });
    });
});
