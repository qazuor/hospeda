import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    RevalidationLogSchema,
    RevalidationStatusEnum,
    RevalidationTriggerEnum
} from '../../../src/entities/revalidation/revalidation-log.schema.js';
import { RevalidationLogFilterSchema } from '../../../src/entities/revalidation/revalidation-log.query.schema.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const createValidLog = () => ({
    id: '12345678-1234-4234-8234-123456789012',
    path: '/en/accommodations/hotel-palace',
    entityType: 'accommodation',
    entityId: '98765432-9876-4876-8876-987654321098',
    trigger: 'manual' as const,
    triggeredBy: 'admin-user-id',
    status: 'success' as const,
    durationMs: 123,
    errorMessage: null,
    metadata: null,
    createdAt: new Date('2024-01-01T00:00:00Z')
});

// ---------------------------------------------------------------------------
// RevalidationTriggerEnum
// ---------------------------------------------------------------------------

describe('RevalidationTriggerEnum', () => {
    const validTriggers = ['manual', 'hook', 'cron', 'stale'] as const;

    it('should accept all valid trigger values', () => {
        for (const trigger of validTriggers) {
            const result = RevalidationTriggerEnum.safeParse(trigger);
            expect(result.success).toBe(true);
        }
    });

    it('should reject unknown trigger values', () => {
        const invalid = ['MANUAL', 'webhook', 'auto', '', 'schedule'];
        for (const val of invalid) {
            const result = RevalidationTriggerEnum.safeParse(val);
            expect(result.success).toBe(false);
        }
    });

    it('should reject non-string values', () => {
        expect(RevalidationTriggerEnum.safeParse(1).success).toBe(false);
        expect(RevalidationTriggerEnum.safeParse(null).success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// RevalidationStatusEnum
// ---------------------------------------------------------------------------

describe('RevalidationStatusEnum', () => {
    const validStatuses = ['success', 'failed', 'skipped'] as const;

    it('should accept all valid status values', () => {
        for (const status of validStatuses) {
            const result = RevalidationStatusEnum.safeParse(status);
            expect(result.success).toBe(true);
        }
    });

    it('should reject unknown status values', () => {
        const invalid = ['SUCCESS', 'error', 'pending', '', 'done'];
        for (const val of invalid) {
            const result = RevalidationStatusEnum.safeParse(val);
            expect(result.success).toBe(false);
        }
    });

    it('should reject non-string values', () => {
        expect(RevalidationStatusEnum.safeParse(true).success).toBe(false);
        expect(RevalidationStatusEnum.safeParse(null).success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// RevalidationLogSchema
// ---------------------------------------------------------------------------

describe('RevalidationLogSchema', () => {
    describe('Valid data', () => {
        it('should validate a complete valid log entry', () => {
            const data = createValidLog();
            expect(() => RevalidationLogSchema.parse(data)).not.toThrow();

            const result = RevalidationLogSchema.parse(data);
            expect(result.id).toBe(data.id);
            expect(result.path).toBe(data.path);
            expect(result.entityType).toBe('accommodation');
            expect(result.trigger).toBe('manual');
            expect(result.status).toBe('success');
        });

        it('should validate a minimal log entry (only required fields)', () => {
            const data = {
                id: '12345678-1234-4234-8234-123456789012',
                path: '/es/destinos/litoral',
                entityType: 'destination',
                trigger: 'cron' as const,
                status: 'skipped' as const,
                createdAt: new Date('2024-03-01T00:00:00Z')
            };
            const result = RevalidationLogSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept all valid trigger enum values', () => {
            const triggers = ['manual', 'hook', 'cron', 'stale'] as const;
            for (const trigger of triggers) {
                const data = { ...createValidLog(), trigger };
                expect(RevalidationLogSchema.safeParse(data).success).toBe(true);
            }
        });

        it('should accept all valid status enum values', () => {
            const statuses = ['success', 'failed', 'skipped'] as const;
            for (const status of statuses) {
                const data = { ...createValidLog(), status };
                expect(RevalidationLogSchema.safeParse(data).success).toBe(true);
            }
        });

        it('should coerce string createdAt to Date', () => {
            const data = { ...createValidLog(), createdAt: '2024-06-15T10:30:00Z' };
            const result = RevalidationLogSchema.parse(data);
            expect(result.createdAt).toBeInstanceOf(Date);
        });

        it('should accept null for nullable optional fields', () => {
            const data = {
                ...createValidLog(),
                entityId: null,
                triggeredBy: null,
                durationMs: null,
                errorMessage: null,
                metadata: null
            };
            expect(RevalidationLogSchema.safeParse(data).success).toBe(true);
        });

        it('should accept metadata as a record of unknown values', () => {
            const data = {
                ...createValidLog(),
                metadata: { origin: 'webhook', batchId: 42, tags: ['a', 'b'] }
            };
            const result = RevalidationLogSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept integer durationMs', () => {
            const data = { ...createValidLog(), durationMs: 0 };
            expect(RevalidationLogSchema.safeParse(data).success).toBe(true);

            const data2 = { ...createValidLog(), durationMs: 99999 };
            expect(RevalidationLogSchema.safeParse(data2).success).toBe(true);
        });
    });

    describe('Invalid data', () => {
        it('should reject entry with missing required fields', () => {
            const result = RevalidationLogSchema.safeParse({ path: '/en/test' });
            expect(result.success).toBe(false);
        });

        it('should reject invalid UUID for id', () => {
            const data = { ...createValidLog(), id: 'not-a-uuid' };
            expect(RevalidationLogSchema.safeParse(data).success).toBe(false);
        });

        it('should reject invalid trigger value', () => {
            const data = { ...createValidLog(), trigger: 'scheduled' };
            expect(RevalidationLogSchema.safeParse(data).success).toBe(false);
        });

        it('should reject invalid status value', () => {
            const data = { ...createValidLog(), status: 'error' };
            expect(RevalidationLogSchema.safeParse(data).success).toBe(false);
        });

        it('should reject non-integer durationMs', () => {
            const data = { ...createValidLog(), durationMs: 12.5 };
            expect(RevalidationLogSchema.safeParse(data).success).toBe(false);
        });

        it('should throw ZodError when using .parse() on invalid input', () => {
            expect(() =>
                RevalidationLogSchema.parse({ id: 'bad', path: 123, trigger: 'bad', status: 'bad' })
            ).toThrow(ZodError);
        });
    });

    describe('Optional fields', () => {
        it('should allow entityId to be absent', () => {
            const { entityId: _entityId, ...data } = createValidLog();
            expect(RevalidationLogSchema.safeParse(data).success).toBe(true);
        });

        it('should allow triggeredBy to be absent', () => {
            const { triggeredBy: _triggeredBy, ...data } = createValidLog();
            expect(RevalidationLogSchema.safeParse(data).success).toBe(true);
        });

        it('should allow durationMs to be absent', () => {
            const { durationMs: _durationMs, ...data } = createValidLog();
            expect(RevalidationLogSchema.safeParse(data).success).toBe(true);
        });

        it('should allow errorMessage to be absent', () => {
            const { errorMessage: _errorMessage, ...data } = createValidLog();
            expect(RevalidationLogSchema.safeParse(data).success).toBe(true);
        });

        it('should allow metadata to be absent', () => {
            const { metadata: _metadata, ...data } = createValidLog();
            expect(RevalidationLogSchema.safeParse(data).success).toBe(true);
        });
    });

    describe('Type inference', () => {
        it('should produce correct runtime types', () => {
            const result = RevalidationLogSchema.parse(createValidLog());
            expect(typeof result.id).toBe('string');
            expect(typeof result.path).toBe('string');
            expect(typeof result.entityType).toBe('string');
            expect(typeof result.trigger).toBe('string');
            expect(typeof result.status).toBe('string');
            expect(result.createdAt).toBeInstanceOf(Date);
        });
    });
});

// ---------------------------------------------------------------------------
// RevalidationLogFilterSchema
// ---------------------------------------------------------------------------

describe('RevalidationLogFilterSchema', () => {
    describe('Valid data', () => {
        it('should validate an empty object using defaults', () => {
            const result = RevalidationLogFilterSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(50);
        });

        it('should validate a full filter payload', () => {
            const data = {
                entityType: 'accommodation',
                entityId: 'some-entity-id',
                trigger: 'manual' as const,
                status: 'success' as const,
                fromDate: new Date('2024-01-01'),
                toDate: new Date('2024-12-31'),
                page: 2,
                pageSize: 25
            };
            const result = RevalidationLogFilterSchema.parse(data);
            expect(result.entityType).toBe('accommodation');
            expect(result.trigger).toBe('manual');
            expect(result.status).toBe('success');
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(25);
        });

        it('should coerce string values for page and pageSize', () => {
            const result = RevalidationLogFilterSchema.parse({ page: '3', pageSize: '10' });
            expect(result.page).toBe(3);
            expect(result.pageSize).toBe(10);
        });

        it('should coerce date strings for fromDate and toDate', () => {
            const result = RevalidationLogFilterSchema.parse({
                fromDate: '2024-01-01',
                toDate: '2024-06-30'
            });
            expect(result.fromDate).toBeInstanceOf(Date);
            expect(result.toDate).toBeInstanceOf(Date);
        });

        it('should accept boundary page values (min 1)', () => {
            const result = RevalidationLogFilterSchema.safeParse({ page: 1 });
            expect(result.success).toBe(true);
        });

        it('should accept boundary pageSize values (min 1, max 100)', () => {
            expect(RevalidationLogFilterSchema.safeParse({ pageSize: 1 }).success).toBe(true);
            expect(RevalidationLogFilterSchema.safeParse({ pageSize: 100 }).success).toBe(true);
        });

        it('should validate a filter with only trigger', () => {
            const result = RevalidationLogFilterSchema.parse({ trigger: 'cron' });
            expect(result.trigger).toBe('cron');
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(50);
        });

        it('should validate a filter with only status', () => {
            const result = RevalidationLogFilterSchema.parse({ status: 'failed' });
            expect(result.status).toBe('failed');
        });
    });

    describe('Invalid data', () => {
        it('should reject page below minimum (1)', () => {
            const result = RevalidationLogFilterSchema.safeParse({ page: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject pageSize below minimum (1)', () => {
            const result = RevalidationLogFilterSchema.safeParse({ pageSize: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject pageSize above maximum (100)', () => {
            const result = RevalidationLogFilterSchema.safeParse({ pageSize: 101 });
            expect(result.success).toBe(false);
        });

        it('should reject non-integer page values', () => {
            const result = RevalidationLogFilterSchema.safeParse({ page: 1.5 });
            expect(result.success).toBe(false);
        });

        it('should reject non-integer pageSize values', () => {
            const result = RevalidationLogFilterSchema.safeParse({ pageSize: 10.5 });
            expect(result.success).toBe(false);
        });

        it('should reject invalid trigger enum value', () => {
            const result = RevalidationLogFilterSchema.safeParse({ trigger: 'scheduled' });
            expect(result.success).toBe(false);
        });

        it('should reject invalid status enum value', () => {
            const result = RevalidationLogFilterSchema.safeParse({ status: 'pending' });
            expect(result.success).toBe(false);
        });
    });

    describe('Default values', () => {
        it('should default page to 1', () => {
            const result = RevalidationLogFilterSchema.parse({});
            expect(result.page).toBe(1);
        });

        it('should default pageSize to 50', () => {
            const result = RevalidationLogFilterSchema.parse({});
            expect(result.pageSize).toBe(50);
        });

        it('should leave optional filter fields as undefined when absent', () => {
            const result = RevalidationLogFilterSchema.parse({});
            expect(result.entityType).toBeUndefined();
            expect(result.entityId).toBeUndefined();
            expect(result.trigger).toBeUndefined();
            expect(result.status).toBeUndefined();
            expect(result.fromDate).toBeUndefined();
            expect(result.toDate).toBeUndefined();
        });
    });
});
