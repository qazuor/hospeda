import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { DomainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { closeTestPool, getTestDb, withTestTransaction } from './helpers.ts';

beforeAll(() => setDb(getTestDb()));
afterAll(closeTestPool);
describe('TEST:1607:14 domain event range', () => {
    it('filters types and (after, until], pages by id, and counts consistently', async () => {
        await withTestTransaction(async (tx) => {
            const model = new DomainEventModel();
            const after = new Date('2026-10-01T00:00:00Z'),
                until = new Date('2026-10-01T00:10:00Z');
            const base = {
                entityType: 'subscription',
                actorType: 'job' as const,
                correlationId: '00000000-0000-4000-8000-000000000001',
                tx
            };
            await model.insert({
                ...base,
                eventType: 'reconciliation.mark_opened',
                entityId: 'lower',
                occurredAt: after
            });
            await model.insert({
                ...base,
                eventType: 'reconciliation.mark_opened',
                entityId: 'inside',
                occurredAt: new Date('2026-10-01T00:05:00Z')
            });
            await model.insert({
                ...base,
                eventType: 'reconciliation.mark_escalated',
                entityId: 'other',
                occurredAt: new Date('2026-10-01T00:06:00Z')
            });
            await model.insert({
                ...base,
                eventType: 'reconciliation.mark_opened',
                entityId: 'upper',
                occurredAt: until
            });
            const types = ['reconciliation.mark_opened'] as const;
            const first = await model.listByTypesInRange({
                eventTypes: types,
                after,
                until,
                limit: 1,
                tx
            });
            const second = await model.listByTypesInRange({
                eventTypes: types,
                after,
                until,
                afterEventId: first[0]?.id,
                limit: 10,
                tx
            });
            expect([...first, ...second].map((row) => row.entityId).sort()).toEqual([
                'inside',
                'upper'
            ]);
            expect(await model.countByTypesInRange({ eventTypes: types, after, until, tx })).toBe(
                2
            );
        });
    });
});
