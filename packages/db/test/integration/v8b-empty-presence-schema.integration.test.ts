/** Integration coverage for the ACC:25 permission enum and domain event CHECK. */
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

/** Builds a valid ACC:25 admin event tied to an isolated Partner id. */
function event(tx: DrizzleClient, eventType: string) {
    return {
        tx,
        eventType: eventType as DomainEventType,
        entityType: 'partner',
        entityId: randomUUID(),
        actorId: randomUUID(),
        actorType: 'admin' as const,
        reason: 'Owner requested removal of the Partner presence',
        correlationId: randomUUID(),
        changes: [{ field: 'description' }]
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

describe('AC:V8b:6 ACC:25 schema contract', () => {
    it('adds partner.emptyPresence to permission_enum', async () => {
        await withTestTransaction(async (tx) => {
            const result = await tx.execute(
                sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'permission_enum'::regtype AND enumlabel = 'partner.emptyPresence'`
            );
            expect(result.rows).toHaveLength(1);
        });
    });

    it('accepts the new Partner event, then rejects a type outside the catalog', async () => {
        await withTestTransaction(async (tx) => {
            expect(DOMAIN_EVENT_TYPES).toContain('partner.presence_emptied');
            const accepted = await events.insert(event(tx, 'partner.presence_emptied'));
            expect(accepted.eventType).toBe('partner.presence_emptied');
            expect(accepted.entityType).toBe('partner');

            let caught: unknown = null;
            try {
                await tx.transaction(async (sp) => {
                    await events.insert(event(sp, 'partner.presence_emtpied'));
                });
            } catch (error) {
                caught = error;
            }
            expect(caught).not.toBeNull();
            expect(sqlStatesOf(caught)).toContain('23514');
        });
    });
});
