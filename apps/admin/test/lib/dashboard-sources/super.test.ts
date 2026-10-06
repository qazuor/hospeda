import { beforeAll, describe, expect, it } from 'vitest';
import { isSourceRegistered } from '@/lib/dashboard-sources';

beforeAll(async () => {
    await import('@/lib/dashboard-sources/super');
});

describe('SUPER_ADMIN source registrations', () => {
    it('does not register the retired billing metrics source', () => {
        expect(isSourceRegistered('super.billing.stats')).toBe(false);
    });

    it('keeps audit, security and Sentry slots deferred', () => {
        expect(isSourceRegistered('super.audit.log')).toBe(false);
        expect(isSourceRegistered('super.audit.log.actions')).toBe(false);
        expect(isSourceRegistered('super.audit.log.security')).toBe(false);
        expect(isSourceRegistered('super.audit.log.sentry')).toBe(false);
    });
});
