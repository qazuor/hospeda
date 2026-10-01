/**
 * HOS-410: every boolean `HttpQueryFields` factory, and the filters that used to
 * invert their result set, must treat `=false` as false.
 */
import { describe, expect, it } from 'vitest';
import { ListCustomerAddonsQuerySchema } from '../../src/api/billing/customer-addons.schema.js';
import { HttpQueryFields } from '../../src/api/http/base-http.schema.js';
import { AdminSearchBaseSchema } from '../../src/common/admin-search.schema.js';
import { GuestInboxQuerySchema } from '../../src/entities/conversation/conversation.query.schema.js';

type Factory = () => { safeParse: (input: unknown) => { success: boolean; data?: unknown } };

const factories = Object.entries(HttpQueryFields as Record<string, Factory>);

/** A factory is boolean when it accepts the literal "true" and yields a boolean. */
const booleanFactories = factories.filter(([, make]) => {
    const parsed = make().safeParse('true');
    return parsed.success && typeof parsed.data === 'boolean';
});

/** Boolean factories whose absent value is `true`. */
const DEFAULTS_TRUE = new Set(['searchInDescription', 'fuzzySearch']);
/** Boolean factories whose absent value is `false`. */
const DEFAULTS_FALSE = new Set(['groupByCategory']);

describe('HttpQueryFields boolean factories (HOS-410)', () => {
    it('finds the boolean factories (guards against the discovery silently matching none)', () => {
        expect(booleanFactories.length).toBeGreaterThanOrEqual(30);
    });

    describe.each(booleanFactories)('%s', (name, make) => {
        it('"false" parses to false, not true', () => {
            const result = make().safeParse('false');

            expect(result.success).toBe(true);
            expect(result.data).toBe(false);
        });

        it('"true" parses to true', () => {
            expect(make().safeParse('true').data).toBe(true);
        });

        it.each(['', '1', 'yes'])('rejects %j', (value) => {
            expect(make().safeParse(value).success).toBe(false);
        });

        it('absent applies the documented default only', () => {
            const result = make().safeParse(undefined);

            expect(result.success).toBe(true);
            if (DEFAULTS_TRUE.has(name)) expect(result.data).toBe(true);
            else if (DEFAULTS_FALSE.has(name)) expect(result.data).toBe(false);
            else expect(result.data).toBeUndefined();
        });
    });
});

describe('filters that used to return the opposite set on =false (HOS-410)', () => {
    it('includeDeleted=false stays false on customer add-ons', () => {
        const parsed = ListCustomerAddonsQuerySchema.parse({ includeDeleted: 'false' });

        expect(parsed.includeDeleted).toBe(false);
    });

    it('includeDeleted=true is true and absent is false on customer add-ons', () => {
        expect(ListCustomerAddonsQuerySchema.parse({ includeDeleted: 'true' }).includeDeleted).toBe(
            true
        );
        expect(ListCustomerAddonsQuerySchema.parse({}).includeDeleted).toBe(false);
    });

    it('includeDeleted=false stays false on the shared admin search base', () => {
        expect(AdminSearchBaseSchema.parse({ includeDeleted: 'false' }).includeDeleted).toBe(false);
    });

    it('archivedByGuest=false stays false on the guest inbox', () => {
        expect(GuestInboxQuerySchema.parse({ archivedByGuest: 'false' }).archivedByGuest).toBe(
            false
        );
    });
});
