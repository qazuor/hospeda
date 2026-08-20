/**
 * Regression test for HOS-701 — 18 models carried the same `getTableName()`
 * mismatch that caused HOS-598's production 500 on 7 relation/junction
 * models: `getTableName()` returned the snake_case SQL table name (e.g.
 * `'content_moderation_terms'`) while `db.query` — built from the schema
 * barrel (`packages/db/src/schemas/index.ts`, spread into `drizzle()` in
 * `packages/db/src/client.ts`) — only ever exposes the camelCase EXPORT
 * identifier (`contentModerationTerms`). `BaseModelImpl.findAllWithRelations`
 * / `findOneWithRelations` resolve the relational query builder via
 * `db.query[this.getTableName()]`, so the mismatch throws
 * `Invalid table configuration for: <wrong name>` the instant a caller
 * requests any relation, independent of the query input.
 *
 * None of these 18 were reachable through that code path at the time this
 * test was written (verified statically: every `BaseCrudService` built on
 * one of them overrides `getDefaultListRelations()` to return `undefined`,
 * and no route passes an explicit `relations` option), so the bug was
 * latent rather than live in production — but the exact same landmine.
 *
 * This suite deliberately runs against the REAL combined Drizzle schema
 * (via `getTestDb()` / `withTestTransaction`,
 * `packages/db/test/integration/helpers.ts`) rather than the mocked
 * `@repo/db` used by `apps/api`'s default test setup — the bug only
 * reproduces when `db.query` is built from the actual schema module, which
 * a mocked model instance never exercises. See
 * `packages/db/test/models/relation-model-table-name-registration.guard.test.ts`
 * for the companion static guard that keeps every model's `getTableName()`
 * pinned to its `table` field's export identifier going forward.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { AppLogEntryModel } from '../../src/models/app-log/appLogEntry.model.ts';
import { AuditLogEntryModel } from '../../src/models/audit-log/auditLogEntry.model.ts';
import { BillingPendingCheckoutModel } from '../../src/models/billing/billing-pending-checkout.model.ts';
import { BillingAddonPurchaseModel } from '../../src/models/billing/billingAddonPurchase.model.ts';
import { BillingDunningAttemptModel } from '../../src/models/billing/billingDunningAttempt.model.ts';
import { BillingMpPlanModel } from '../../src/models/billing/billingMpPlan.model.ts';
import { BillingNotificationLogModel } from '../../src/models/billing/billingNotificationLog.model.ts';
import { BillingSettingsModel } from '../../src/models/billing/billingSettings.model.ts';
import { BillingSubscriptionEventModel } from '../../src/models/billing/billingSubscriptionEvent.model.ts';
import { ContentModerationTermModel } from '../../src/models/content-moderation/term.model.ts';
import { ContentModerationThresholdModel } from '../../src/models/content-moderation/threshold.model.ts';
import { CronRunModel } from '../../src/models/cron/cronRun.model.ts';
import { ExchangeRateModel } from '../../src/models/exchange-rate/exchange-rate.model.ts';
import { ExchangeRateConfigModel } from '../../src/models/exchange-rate/exchange-rate-config.model.ts';
import { PlatformSettingsModel } from '../../src/models/platform/platform-settings.model.ts';
import { RevalidationConfigModel } from '../../src/models/revalidation/revalidation-config.model.ts';
import { UserPushTokenModel } from '../../src/models/user/user-push-token.model.ts';
import { UserIdentityModel } from '../../src/models/user/userIdentity.model.ts';
import { contentModerationTerms } from '../../src/schemas/content-moderation/term.dbschema.ts';
import { contentModerationThresholds } from '../../src/schemas/content-moderation/threshold.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

beforeAll(() => {
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

/**
 * All 18 models named in HOS-701, paired with a fresh instance. Order
 * mirrors the ticket's inventory table.
 */
const ALL_18_MODELS = [
    ['AppLogEntryModel', new AppLogEntryModel()],
    ['AuditLogEntryModel', new AuditLogEntryModel()],
    ['BillingAddonPurchaseModel', new BillingAddonPurchaseModel()],
    ['BillingDunningAttemptModel', new BillingDunningAttemptModel()],
    ['BillingMpPlanModel', new BillingMpPlanModel()],
    ['BillingNotificationLogModel', new BillingNotificationLogModel()],
    ['BillingPendingCheckoutModel', new BillingPendingCheckoutModel()],
    ['BillingSettingsModel', new BillingSettingsModel()],
    ['BillingSubscriptionEventModel', new BillingSubscriptionEventModel()],
    ['ContentModerationTermModel', new ContentModerationTermModel()],
    ['ContentModerationThresholdModel', new ContentModerationThresholdModel()],
    ['CronRunModel', new CronRunModel()],
    ['ExchangeRateConfigModel', new ExchangeRateConfigModel()],
    ['ExchangeRateModel', new ExchangeRateModel()],
    ['PlatformSettingsModel', new PlatformSettingsModel()],
    ['RevalidationConfigModel', new RevalidationConfigModel()],
    ['UserIdentityModel', new UserIdentityModel()],
    ['UserPushTokenModel', new UserPushTokenModel()]
] as const;

describe('HOS-701: every model resolves against the REAL db.query barrel', () => {
    it.each(
        ALL_18_MODELS
    )('%s: getTableName() resolves to a real db.query entry with findFirst/findMany', (_className, model) => {
        // This mirrors EXACTLY what BaseModelImpl.findAllWithRelations /
        // findOneWithRelations do internally: `db.query[this.getTableName()]`.
        // Before the HOS-701 fix, this lookup returned `undefined` for all
        // 18 models because getTableName() returned the snake_case SQL name
        // instead of the schema barrel's camelCase export identifier.
        const db = getTestDb();
        const tableName = (model as unknown as { getTableName(): string }).getTableName();
        const queryTable = (db.query as Record<string, unknown>)[tableName];

        expect(
            queryTable,
            `db.query['${tableName}'] is undefined — getTableName() does not match ` +
                'the schema barrel export identifier, so findAllWithRelations()/' +
                'findOneWithRelations() would throw "Invalid table configuration" ' +
                'the instant a relation is requested (HOS-598/HOS-701).'
        ).toBeDefined();
        expect(typeof queryTable).toBe('object');
        expect(queryTable).toHaveProperty('findFirst');
        expect(queryTable).toHaveProperty('findMany');
    });
});

/** Minimal content-moderation term row satisfying all NOT NULL constraints. */
function termFixture(createdById: string): typeof contentModerationTerms.$inferInsert {
    return {
        id: crypto.randomUUID(),
        term: `hos701-term-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'word',
        category: 'profanity',
        severity: 0.5,
        enabled: true,
        createdById
    };
}

/** Minimal content-moderation threshold row satisfying all NOT NULL constraints. */
function thresholdFixture(createdById: string): typeof contentModerationThresholds.$inferInsert {
    return {
        id: crypto.randomUUID(),
        context: `hos701-context-${crypto.randomUUID().slice(0, 8)}`,
        pending: 0.5,
        reject: 0.8,
        createdById
    };
}

describe('ContentModerationTermModel.findOneWithRelations (HOS-701 end-to-end)', () => {
    it('does NOT throw "Invalid table configuration" and populates the createdBy relation', async () => {
        await withTestTransaction(async (tx: DrizzleClient) => {
            const [creator] = await tx.insert(users).values(testData.user()).returning();
            if (!creator) throw new Error('Failed to insert creator');

            const [term] = await tx
                .insert(contentModerationTerms)
                .values(termFixture(creator.id))
                .returning();
            if (!term) throw new Error('Failed to insert term');

            const model = new ContentModerationTermModel();

            const found = await model.findOneWithRelations(
                { id: term.id },
                { createdBy: true },
                tx
            );

            expect(found).not.toBeNull();
            expect((found as unknown as { createdBy: { id: string } }).createdBy.id).toBe(
                creator.id
            );
        });
    });
});

describe('ContentModerationThresholdModel.findAllWithRelations (HOS-701 end-to-end)', () => {
    it('does NOT throw "Invalid table configuration" and populates the createdBy relation', async () => {
        await withTestTransaction(async (tx: DrizzleClient) => {
            const [creator] = await tx.insert(users).values(testData.user()).returning();
            if (!creator) throw new Error('Failed to insert creator');

            const [threshold] = await tx
                .insert(contentModerationThresholds)
                .values(thresholdFixture(creator.id))
                .returning();
            if (!threshold) throw new Error('Failed to insert threshold');

            const model = new ContentModerationThresholdModel();

            const { items, total } = await model.findAllWithRelations(
                { createdBy: true },
                { id: threshold.id },
                { page: 1, pageSize: 10 },
                undefined,
                tx
            );

            expect(total).toBe(1);
            expect(items).toHaveLength(1);
            expect((items[0] as unknown as { createdBy: { id: string } }).createdBy.id).toBe(
                creator.id
            );
        });
    });
});
