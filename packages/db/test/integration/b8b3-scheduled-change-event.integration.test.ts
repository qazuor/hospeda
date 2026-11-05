/** Database contract for the S38 audit event (TEST:B8b:15). */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { DOMAIN_EVENT_TYPES, DomainEventModel, type DomainEventType } from '../../src/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

function sqlStatesOf(error: unknown): readonly string[] {
    const codes: string[] = [];
    let current: unknown = error;
    for (let depth = 0; current !== null && typeof current === 'object' && depth < 10; depth += 1) {
        const wrapped = current as { code?: unknown; cause?: unknown };
        if (typeof wrapped.code === 'string') codes.push(wrapped.code);
        current = wrapped.cause;
    }
    return codes;
}

function event(tx: DrizzleClient, eventType: string) {
    return {
        tx,
        eventType: eventType as DomainEventType,
        entityType: 'subscription',
        entityId: randomUUID(),
        actorType: 'job' as const,
        correlationId: randomUUID(),
        reason: 'S38',
        changes: [
            { field: 'plan_version_id', old: randomUUID(), new: randomUUID() },
            { field: 'billing_option_id', old: randomUUID(), new: randomUUID() }
        ]
    };
}

describe('TEST:B8b:15 S38 audit event schema', () => {
    it('accepts the scheduled change event and rejects a misspelling with SQLSTATE 23514', async () => {
        const model = new DomainEventModel();
        await withTestTransaction(async (tx) => {
            expect(DOMAIN_EVENT_TYPES).toContain('subscription.scheduled_change_applied');
            const accepted = await model.insert(event(tx, 'subscription.scheduled_change_applied'));
            expect(accepted.eventType).toBe('subscription.scheduled_change_applied');
            expect(accepted.actorType).toBe('job');

            let caught: unknown = null;
            try {
                await tx.transaction(async (sp) => {
                    await model.insert(event(sp, 'subscription.scheduled_change_applie'));
                });
            } catch (error) {
                caught = error;
            }
            expect(caught).not.toBeNull();
            expect(sqlStatesOf(caught)).toContain('23514');
        });
    });
});
