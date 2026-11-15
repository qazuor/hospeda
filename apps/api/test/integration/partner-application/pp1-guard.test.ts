import { getDb, partnerApplicationModel, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { submitPartnerApplication } from '../../../src/services/partner-application/partner-application-submission.service';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createApplicationEmail,
    deleteApplications,
    insertRejected,
    readApplications
} from './partner-application.helpers';

const EXPECTED_REASON = 'PARTNER_APPLICATION_UNAVAILABLE';
const testEmails: string[] = [];
const rememberEmail = () => {
    const email = createApplicationEmail();
    testEmails.push(email);
    return email;
};

async function expectUnavailable(action: Promise<unknown>): Promise<ServiceError> {
    let thrown: unknown;
    try {
        await action;
    } catch (error) {
        thrown = error;
    }
    expect(thrown).toBeInstanceOf(ServiceError);
    const serviceError = thrown as ServiceError;
    expect(serviceError.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
    expect(serviceError.reason).toBe(EXPECTED_REASON);
    return serviceError;
}

function hasWaitTriggerCause(error: unknown): boolean {
    const seen = new Set<object>();
    let current: unknown = error;
    for (let depth = 0; depth < 10; depth++) {
        if (current === null || typeof current !== 'object' || seen.has(current)) return false;
        seen.add(current);
        const candidate = current as Record<string, unknown>;
        if (
            candidate.code === 'P0001' &&
            typeof candidate.message === 'string' &&
            candidate.message.startsWith('partner_application_wait_active')
        )
            return true;
        current = candidate.cause;
    }
    return false;
}

async function checkDatabasePreconditions(): Promise<void> {
    const trigger = await getDb().execute(sql`
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'partner_application_wait_active' AND NOT tgisinternal`);
    expect(
        trigger.rows,
        'Required partner_application_wait_active trigger is missing'
    ).toHaveLength(1);
    const deadline = await getDb().execute(sql`
        SELECT 1 FROM vertical_deadline_version WHERE "values" ? '9' LIMIT 1`);
    expect(
        deadline.rows,
        'Required PLAZO:9 value is missing from vertical_deadline_version'
    ).toHaveLength(1);
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    await checkDatabasePreconditions();
});
afterEach(async () => {
    for (const email of testEmails.splice(0)) await deleteApplications({ email });
});
afterAll(async () => testDb.teardown());

describe('TEST:V7:2 PP1 database guards', () => {
    it('allows one of two simultaneous case-insensitive inserts and translates the loser', async () => {
        const email = rememberEmail();
        const results = await Promise.allSettled([
            submitPartnerApplication({ email }),
            submitPartnerApplication({ email: email.toUpperCase() })
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.filter((result) => result.status === 'rejected');
        expect(rejected).toHaveLength(1);
        const error = (rejected[0] as PromiseRejectedResult).reason;
        expect(error).toBeInstanceOf(ServiceError);
        expect(error).toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: EXPECTED_REASON
        });
        const rows = await readApplications({ email });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('PENDING');
    });

    it('keeps the original pending row when a later submission is rejected', async () => {
        const email = rememberEmail();
        await submitPartnerApplication({ email });
        const before = await readApplications({ email });
        expect(before).toHaveLength(1);
        await expectUnavailable(submitPartnerApplication({ email }));
        const after = await readApplications({ email });
        expect(after).toHaveLength(1);
        expect(after[0]?.id).toBe(before[0]?.id);
        expect(after[0]?.status).toBe('PENDING');
    });

    it('translates an active rejection wait and leaves the rejected row unchanged', async () => {
        const email = rememberEmail();
        const rejectedId = await insertRejected({ email, resolvedDaysAgo: 1 });
        const before = await readApplications({ email });
        expect(before).toHaveLength(1);
        await expectUnavailable(submitPartnerApplication({ email }));
        expect(await readApplications({ email })).toEqual(before);
        expect(before[0]?.id).toBe(rejectedId);
        expect(before[0]?.status).toBe('REJECTED');
    });

    it('proves the trigger rejects directly at the database layer', async () => {
        const email = rememberEmail();
        const rejectedId = await insertRejected({ email, resolvedDaysAgo: 1 });
        let thrown: unknown;
        try {
            await getDb().transaction(async (tx) =>
                partnerApplicationModel.insertPending({ tx, email })
            );
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeDefined();
        expect(hasWaitTriggerCause(thrown)).toBe(true);
        const rows = await readApplications({ email });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.id).toBe(rejectedId);
        expect(rows[0]?.status).toBe('REJECTED');
    });
});
