/**
 * TEST:V8a:15 (HOS-1494, admin action 24) — the schema half of the account
 * close on request: its own permission value exists in `permission_enum`, and
 * the `domain_event` CHECK accepts the two event types the action writes while
 * still rejecting a type outside the closed catalog.
 *
 * Every write runs inside `withTestTransaction`, so nothing is committed
 * (`domain_event` rows cannot be deleted afterwards).
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
    DomainEventModel,
    type InsertDomainEventInput
} from '../../src/models/domain-event/domain-event.model.ts';
import {
    DOMAIN_EVENT_TYPES,
    type DomainEventType
} from '../../src/schemas/domain-event/domain_event.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const events = new DomainEventModel();

/** Walks the `cause` chain and returns every SQLSTATE found on it. */
function sqlStatesOf(error: unknown): readonly string[] {
    const codes: string[] = [];
    let current: unknown = error;
    let depth = 0;
    while (current !== null && typeof current === 'object' && depth < 10) {
        const code = (current as { code?: unknown }).code;
        if (typeof code === 'string') codes.push(code);
        current = (current as { cause?: unknown }).cause;
        depth += 1;
    }
    return codes;
}

/** Builds one admin event of the given type on a random subject. */
function adminEvent({
    eventType,
    entityType,
    tx
}: {
    readonly eventType: DomainEventType;
    readonly entityType: string;
    readonly tx: DrizzleClient;
}): InsertDomainEventInput {
    return {
        eventType,
        entityType,
        entityId: randomUUID(),
        actorId: randomUUID(),
        actorType: 'admin',
        correlationId: randomUUID(),
        changes: [{ field: 'email' }],
        reason: 'owner asked to close the account',
        tx
    };
}

describe('TEST:V8a:15 account close on request permission and event types', () => {
    it('contains user.closeOnRequest in permission_enum', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange + Act
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = 'user.closeOnRequest'`
            );

            // Assert
            expect(result.rows).toHaveLength(1);
        });
    });

    it('declares both action 24 event types in the TS catalog the CHECK mirrors', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const result = await tx.execute(
                sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'domain_event_event_type_check'`
            );
            const definition = String((result.rows[0] as { def?: unknown } | undefined)?.def);

            // Act + Assert: the TS list carries both new types, and the CHECK each TS type.
            expect(DOMAIN_EVENT_TYPES).toContain('account.closed_on_request');
            expect(DOMAIN_EVENT_TYPES).toContain('partner_application.email_replaced');
            for (const eventType of DOMAIN_EVENT_TYPES) {
                expect(definition).toContain(`'${eventType}'`);
            }
        });
    });

    it('accepts account.closed_on_request on a user', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const input = adminEvent({
                eventType: 'account.closed_on_request',
                entityType: 'user',
                tx
            });

            // Act
            const row = await events.insert(input);

            // Assert
            expect(row.eventType).toBe('account.closed_on_request');
            expect(row.entityType).toBe('user');
        });
    });

    it('accepts partner_application.email_replaced on a partner application', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const input = adminEvent({
                eventType: 'partner_application.email_replaced',
                entityType: 'partner_application',
                tx
            });

            // Act
            const row = await events.insert(input);

            // Assert
            expect(row.eventType).toBe('partner_application.email_replaced');
            expect(row.entityType).toBe('partner_application');
        });
    });

    it('rejects a made-up account event type through the CHECK', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange: the type is outside the catalog on purpose.
            const input = adminEvent({
                eventType: 'account.closed' as DomainEventType,
                entityType: 'user',
                tx
            });

            // Act: own savepoint, so the aborted statement does not poison the tx.
            let caught: unknown = null;
            try {
                await tx.transaction(async (sp) => {
                    await events.insert({ ...input, tx: sp });
                });
            } catch (error) {
                caught = error;
            }

            // Assert
            expect(caught).not.toBeNull();
            expect(sqlStatesOf(caught)).toContain('23514');
        });
    });
});
