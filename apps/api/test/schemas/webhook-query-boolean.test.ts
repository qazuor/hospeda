/**
 * HOS-410: `livemode` and `resolved` used `z.coerce.boolean()`, so `=false`
 * returned the SAME set as `=true` (the opposite of what an operator asked for
 * when hunting for unresolved or test-mode events).
 */
import { describe, expect, it } from 'vitest';
import {
    ListDeadLetterQueueQuerySchema,
    ListWebhookEventsQuerySchema
} from '../../src/schemas/webhook.schema';

describe('webhook list query booleans (HOS-410)', () => {
    it.each([
        ['ListWebhookEventsQuerySchema', ListWebhookEventsQuerySchema, 'livemode'],
        ['ListDeadLetterQueueQuerySchema', ListDeadLetterQueueQuerySchema, 'livemode'],
        ['ListDeadLetterQueueQuerySchema', ListDeadLetterQueueQuerySchema, 'resolved']
    ])('%s: %s=false parses to false, not true', (_name, schema, key) => {
        const parsed = schema.parse({ [key]: 'false' }) as Record<string, unknown>;

        expect(parsed[key]).toBe(false);
    });

    it.each([
        ['ListWebhookEventsQuerySchema', ListWebhookEventsQuerySchema, 'livemode'],
        ['ListDeadLetterQueueQuerySchema', ListDeadLetterQueueQuerySchema, 'resolved']
    ])('%s: %s=true parses to true and absent stays undefined', (_name, schema, key) => {
        expect((schema.parse({ [key]: 'true' }) as Record<string, unknown>)[key]).toBe(true);
        expect((schema.parse({}) as Record<string, unknown>)[key]).toBeUndefined();
    });

    it('rejects an ambiguous value with a validation error', () => {
        expect(ListDeadLetterQueueQuerySchema.safeParse({ resolved: '' }).success).toBe(false);
        expect(ListWebhookEventsQuerySchema.safeParse({ livemode: '1' }).success).toBe(false);
    });
});
