import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    and,
    domainEventModel,
    eq,
    getDb,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    permanentGrants,
    subscriptions,
    trials
} from '@repo/db';
import {
    PermanentGrantRevocationResponseSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';
import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';
import { subscribeTrialCoverageConversion } from '../../../src/utils/trial/trial-coverage-listener';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    retireRevocationRouteRows,
    routeClock,
    routeFake,
    seedCardRevocable,
    spyingProvider
} from '../billing-subscription/revocation-route-fixtures';
import { ensureAccommodationCatalog } from '../listing-publication/publication-routes.helpers';
import {
    cleanupPermanentGrantRows,
    grantState,
    markPermanentGrantNoticeSent,
    retireGrantRevokeAddons,
    seedGrantPlan,
    seedGrantRevokeAddon,
    seedGrantUser,
    seedPublishedAccommodationActivation
} from './grant-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_GRANT_COMPLIMENTARY
] as const;
const clock = routeClock();
const fake = routeFake(clock);
const providerSpy = spyingProvider(fake);
let app: ReturnType<typeof initApp>;
let stopTrialListener: (() => void) | undefined;

type Actor = { id: string; role: string; permissions: readonly PermissionEnum[] };

function post(path: string, body: Record<string, unknown>, actor?: Actor) {
    return app.request(path, {
        method: 'POST',
        headers: actorHeaders(actor),
        body: JSON.stringify(body)
    });
}

function makeActor(id: string): Actor {
    return { id, role: 'SUPER_ADMIN', permissions: PERMISSIONS };
}

async function trialRow(userId: string) {
    const [row] = await getDb()
        .select({ id: trials.id, status: trials.status, updatedAt: trials.updatedAt })
        .from(trials)
        .where(and(eq(trials.userId, userId), eq(trials.vertical, VerticalEnum.ACCOMMODATION)));
    return row;
}

async function grantRow(grantId: string) {
    const [row] = await getDb()
        .select({
            revokedAt: permanentGrants.revokedAt,
            revokedBy: permanentGrants.revokedBy,
            revocationReason: permanentGrants.revocationReason
        })
        .from(permanentGrants)
        .where(eq(permanentGrants.id, grantId));
    return row;
}

async function liveSubscriptionIds(userId: string): Promise<string[]> {
    const rows = await getDb()
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, userId),
                inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
            )
        );
    return rows.map(({ id }) => id);
}

async function instanceStatus(instanceId: string): Promise<string | undefined> {
    const [row] = await getDb()
        .select({ status: addonInstances.status })
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    return row?.status;
}

describe('TEST:B9a:7 — revoking through the route keeps the reason and repairs nothing (AC:B9a:7)', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        await ensureAccommodationCatalog();
        app = initApp({ clock, paymentProvider: providerSpy.provider });
        stopTrialListener = subscribeTrialCoverageConversion();
    });
    beforeEach(() => audit.mockClear());
    afterAll(async () => {
        stopTrialListener?.();
        await retireGrantRevokeAddons();
        await cleanupPermanentGrantRows();
        await retireRevocationRouteRows();
        await testDb.teardown();
    });

    it('(a-e) writes the three revocation columns together, turns off the addon and keeps the trial consumed', async () => {
        const principal = await seedCardRevocable({ fake, clock });
        await markPermanentGrantNoticeSent(principal);
        await seedPublishedAccommodationActivation(principal.ownerId);
        const addon = await seedGrantRevokeAddon({
            fake,
            userId: principal.ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            compatibleVerticals: [VerticalEnum.ACCOMMODATION, VerticalEnum.VENUE]
        });
        const actorId = await seedGrantUser('revoke-route-admin');
        const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);

        const granted = await post(
            '/api/v1/admin/billing-permanent-grants',
            {
                beneficiaryUserId: principal.ownerId,
                reason: 'B9a.6 grant to revoke',
                includesAddons: true,
                anchors: [anchor]
            },
            makeActor(actorId)
        );
        expect(granted.status).toBe(201);
        const grantBody = (await granted.json()).data;
        const grantId = grantBody.permanentGrantId as string;

        // Precondition: the real trial listener consumed the trial on the grant.
        const beforeRevoke = await trialRow(principal.ownerId);
        expect(beforeRevoke).toMatchObject({ status: 'TRIAL_CONVERTED' });
        expect(beforeRevoke?.updatedAt).toEqual(expect.any(Date));

        const received: CoverageChangedEvent[] = [];
        const stopWatcher = getCoverageNotices().onCoverageChanged((event) => {
            if (event.userId === principal.ownerId) received.push(event);
        });
        const reason = 'Revocado tras revisión';
        const callsBeforeRevoke = providerSpy.calls.length;
        audit.mockClear();

        const revoked = await post(
            `/api/v1/admin/billing-permanent-grants/${grantId}/revocation`,
            { reason: `  ${reason}  ` },
            makeActor(actorId)
        );
        stopWatcher();

        expect(revoked.status).toBe(200);
        const envelope = await revoked.json();
        const parsed = PermanentGrantRevocationResponseSchema.safeParse(envelope.data);
        expect(parsed.success).toBe(true);
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
        expect(parsed.data).toMatchObject({
            permanentGrantId: grantId,
            anchorIds: [expect.any(String)],
            revokedVerticals: [VerticalEnum.ACCOMMODATION],
            cancelledAddonInstanceIds: [addon.instanceId],
            addonProviderCalls: []
        });
        expect(parsed.data.revokedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

        // The three columns are written together, with the trimmed reason.
        const written = await grantRow(grantId);
        expect(written?.revokedAt).toEqual(expect.any(Date));
        expect(written?.revokedBy).toBe(actorId);
        expect(written?.revocationReason).toBe(reason);

        // No row was deleted: the grant and its anchors survive.
        const state = await grantState(principal.ownerId);
        expect(state.grants).toHaveLength(1);
        expect(state.grants[0]?.id).toBe(grantId);
        expect(state.grants[0]?.revokedAt).toEqual(expect.any(Date));
        expect(state.anchors).toHaveLength(1);

        // The converted addon was turned off, not deleted.
        expect(await instanceStatus(addon.instanceId)).toBe('CANCELLED');

        // The trial does not come back: same consumed row, no later transition event.
        const afterRevoke = await trialRow(principal.ownerId);
        expect(afterRevoke?.status).toBe('TRIAL_CONVERTED');
        expect(afterRevoke?.updatedAt).toEqual(expect.any(Date));
        const afterRevokeAt = written?.revokedAt as Date;
        const trialEvents = afterRevoke
            ? await domainEventModel.findByEntity({
                  entityType: 'trial',
                  entityId: afterRevoke.id
              })
            : [];
        expect(
            trialEvents.filter((event) => {
                const occurredAt =
                    event.occurredAt instanceof Date
                        ? event.occurredAt
                        : new Date(event.occurredAt);
                return occurredAt.getTime() > afterRevokeAt.getTime();
            })
        ).toHaveLength(0);

        // The GRANT REMOVED notice reached the process-wide listener.
        expect(received).toContainEqual({
            userId: principal.ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            sourceType: 'GRANT',
            change: 'REMOVED'
        });

        // No grant and no subscription are left live, and no GRANT source remains.
        expect(await liveSubscriptionIds(principal.ownerId)).toEqual([]);
        const coverage = await getListingAccessPorts().billing.coverage({
            userId: principal.ownerId,
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(coverage.sources.filter((source) => source.type === 'GRANT')).toHaveLength(0);

        // The old debit is not resumed: no authorization creation nor reactivation.
        const revokeCalls = providerSpy.calls.slice(callsBeforeRevoke);
        expect(revokeCalls).not.toContain('authorize');
        expect(revokeCalls).not.toContain('resume');

        // The act is audited as ACC_2 with the reason.
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId,
                action: 'update',
                resourceType: 'permanent_grant',
                resourceId: grantId,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_2',
                    transition: 'GRANT_REVOKED',
                    reason
                })
            })
        );
    });

    it('(f) refuses a second revocation, a missing grant, a blank motive and an extra key', async () => {
        const actorId = await seedGrantUser('revoke-route-rejections-admin');
        const beneficiary = await seedGrantUser('revoke-route-rejections-beneficiary');
        const anchor = await seedGrantPlan(VerticalEnum.ACCOMMODATION);
        const granted = await post(
            '/api/v1/admin/billing-permanent-grants',
            {
                beneficiaryUserId: beneficiary,
                reason: 'B9a.6 rejection cases',
                includesAddons: false,
                anchors: [anchor]
            },
            makeActor(actorId)
        );
        expect(granted.status).toBe(201);
        const grantId = (await granted.json()).data.permanentGrantId as string;
        const path = `/api/v1/admin/billing-permanent-grants/${grantId}/revocation`;

        const first = await post(path, { reason: 'First revocation' }, makeActor(actorId));
        expect(first.status).toBe(200);

        const second = await post(path, { reason: 'Second revocation' }, makeActor(actorId));
        expect(second.status).toBe(422);
        expect((await second.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'PERMANENT_GRANT_NOT_LIVE'
        });

        const missing = await post(
            `/api/v1/admin/billing-permanent-grants/${crypto.randomUUID()}/revocation`,
            { reason: 'Missing grant' },
            makeActor(actorId)
        );
        expect(missing.status).toBe(404);
        expect((await missing.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'PERMANENT_GRANT_NOT_FOUND'
        });

        const blank = await post(path, { reason: '   ' }, makeActor(actorId));
        expect(blank.status).toBe(400);
        expect((await blank.json()).error.code).toBe('VALIDATION_ERROR');

        const extra = await post(
            path,
            { reason: 'Extra key', revokedBy: actorId },
            makeActor(actorId)
        );
        expect(extra.status).toBe(400);
        expect((await extra.json()).error.code).toBe('VALIDATION_ERROR');
    });
});
