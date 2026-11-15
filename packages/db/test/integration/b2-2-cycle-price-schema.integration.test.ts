/**
 * AC:B2:4 HOS-1515 — the schema half of admin action 19: its permission value
 * exists in `permission_enum`, the `domain_event` CHECK accepts
 * `billing_option.price_set` and still rejects a type outside the catalog, and
 * the TS catalog mirrors it.
 *
 * Every write runs inside `withTestTransaction`, so nothing is committed
 * (`domain_event` is append-only).
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { DomainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import {
    DOMAIN_EVENT_TYPES,
    type DomainEventType
} from '../../src/schemas/domain-event/domain_event.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const events = new DomainEventModel();

/** Builds a valid admin action 19 event tied to an isolated billing option id. */
function event(tx: DrizzleClient, eventType: string) {
    return {
        tx,
        eventType: eventType as DomainEventType,
        entityType: 'billing_option',
        entityId: randomUUID(),
        actorId: randomUUID(),
        actorType: 'admin' as const,
        reason: null,
        correlationId: randomUUID(),
        changes: [
            { field: 'billing_option.amount', old: 1200, new: 1500 },
            { field: 'billing_option.cycle', new: 'monthly' },
            { field: 'billing_option.plan_version_id', new: randomUUID() },
            { field: 'billing_option.currency', new: 'ARS' }
        ]
    };
}

/** Returns SQLSTATE codes through nested driver errors. */
function sqlStatesOf(error: unknown): readonly string[] {
    const codes: string[] = [];
    let current: unknown = error;
    for (let depth = 0; current !== null && typeof current === 'object' && depth < 10; depth += 1) {
        const code = (current as { code?: unknown }).code;
        if (typeof code === 'string') codes.push(code);
        current = (current as { cause?: unknown }).cause;
    }
    return codes;
}

describe('AC:B2:4 HOS-1515 action 19 schema contract', () => {
    it('a: adds billing.setCyclePrice to permission_enum', async () => {
        await withTestTransaction(async (tx) => {
            const result = await tx.execute(
                sql`SELECT enum_range(NULL::permission_enum) AS values`
            );
            const values = String((result.rows[0] as { values?: unknown } | undefined)?.values);
            expect(values.split(',')).toContain('billing.setCyclePrice');
        });
    });

    it('b: accepts billing_option.price_set, then rejects a type outside the catalog', async () => {
        await withTestTransaction(async (tx) => {
            const accepted = await events.insert(event(tx, 'billing_option.price_set'));
            expect(accepted.eventType).toBe('billing_option.price_set');
            expect(accepted.entityType).toBe('billing_option');

            let caught: unknown = null;
            try {
                await tx.transaction(async (sp) => {
                    await events.insert(event(sp, 'billing_option.price_sett'));
                });
            } catch (error) {
                caught = error;
            }
            expect(caught).not.toBeNull();
            expect(sqlStatesOf(caught)).toContain('23514');
        });
    });

    it('c: declares billing_option.price_set in the TS catalog the CHECK mirrors', () => {
        expect(DOMAIN_EVENT_TYPES).toContain('billing_option.price_set');
    });
});
