import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    addons,
    addonVersions,
    and,
    courtesyGrants,
    eq,
    getDb,
    gt,
    inArray,
    isNull,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { z } from 'zod';
import { findOrphanhoodCandidates } from '../addon/addon-orphanhood.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { selectComplementTargets } from './complement-selection.js';
import { canPause, PAUSE_LIMITS, type PauseRefusalReason } from './pause-policy.js';
import { pauseExpectedEndAt } from './pause-subscription.service.js';

/** Read-only details required to explain a customer-request pause. */
export async function previewPause(
    input: { readonly subscriptionId: string; readonly userId?: string },
    ports: {
        readonly clock: Clock;
        readonly planPolicy: VerticalsForBilling['planPolicy'];
        readonly complements: ComplementPolicyPorts;
    }
): Promise<
    | {
          readonly offered: false;
          readonly reason: PauseRefusalReason;
          readonly courtesyEndsAt?: string;
      }
    | {
          readonly offered: true;
          readonly months: { readonly min: 1; readonly max: number };
          readonly expectedEndAtByMonths: Record<number, string>;
          readonly quota: { readonly pausesLeft: number; readonly monthsLeft: number };
          readonly addons: {
              readonly vertical: readonly string[];
              readonly account: readonly { readonly name: string; readonly pauses: boolean }[];
          };
          readonly courtesyForfeit?: { readonly endsAt: string };
      }
> {
    const value = z
        .strictObject({ subscriptionId: z.uuid(), userId: z.uuid().optional() })
        .parse(input);
    return getDb().transaction(async (tx) => {
        const [row] = await tx
            .select({
                id: subscriptions.id,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical,
                status: subscriptions.status
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.subscriptionId))
            .limit(1);
        if (value.userId && row?.userId !== value.userId)
            return { offered: false, reason: 'NOT_PRINCIPAL' };
        const now = ports.clock.now();
        const previewClock = { now: () => now };
        const [openPause] =
            row?.status === 'PAUSED'
                ? await tx
                      .select({ reason: subscriptionPauses.reason })
                      .from(subscriptionPauses)
                      .where(
                          and(
                              eq(subscriptionPauses.subscriptionId, value.subscriptionId),
                              isNull(subscriptionPauses.actualEndAt)
                          )
                      )
                      .limit(1)
                : [];
        const courtesyForfeit = openPause?.reason === 'COURTESY';
        const eligible = await canPause(
            {
                subscriptionId: value.subscriptionId,
                requestedMonths: 1,
                tx,
                ...(courtesyForfeit ? { courtesyForfeit: true } : {})
            },
            { ...ports, clock: previewClock }
        );
        if (!eligible.allowed) {
            if (eligible.reason !== 'COURTESY_IN_FORCE')
                return { offered: false, reason: eligible.reason };
            const [courtesy] = await tx
                .select({ endsAt: courtesyGrants.endsAt })
                .from(courtesyGrants)
                .where(
                    and(
                        eq(courtesyGrants.subscriptionId, value.subscriptionId),
                        gt(courtesyGrants.endsAt, now)
                    )
                )
                .orderBy(courtesyGrants.endsAt)
                .limit(1);
            return {
                offered: false,
                reason: eligible.reason,
                ...(courtesy ? { courtesyEndsAt: courtesy.endsAt.toISOString() } : {})
            };
        }
        const [courtesyGrant] = courtesyForfeit
            ? await tx
                  .select({ endsAt: courtesyGrants.endsAt })
                  .from(courtesyGrants)
                  .where(
                      and(
                          eq(courtesyGrants.subscriptionId, value.subscriptionId),
                          gt(courtesyGrants.endsAt, now)
                      )
                  )
                  .orderBy(courtesyGrants.endsAt)
                  .limit(1)
            : [];
        if (courtesyForfeit && !courtesyGrant)
            return { offered: false, reason: 'COURTESY_IN_FORCE' };
        if (!row?.userId || !row.vertical)
            throw new Error('Principal subscription lacks owner or vertical');
        const pausesLeft = Math.max(
            0,
            PAUSE_LIMITS.maxPausesPerWindow - eligible.quota.pausesInWindow
        );
        const monthsLeft = Math.max(
            0,
            PAUSE_LIMITS.maxAccumulatedMonths - eligible.quota.monthsInWindow
        );
        const max = Math.min(PAUSE_LIMITS.maxMonthsPerPause, monthsLeft);
        const selected = await selectComplementTargets(
            {
                tx,
                principal: { id: row.id, userId: row.userId, vertical: row.vertical },
                rule: 'PAUSE',
                complementStatus: 'ACTIVE'
            },
            ports.complements
        );
        const selectedIds = new Set(selected.targets.map((target) => target.instanceId));
        const attached = await findOrphanhoodCandidates(
            {
                tx,
                leftRow: {
                    id: row.id,
                    userId: row.userId,
                    vertical: row.vertical,
                    predecessorId: null
                }
            },
            ports.complements
        );
        const attachedIds = attached.candidates.map((candidate) => candidate.id);
        const candidates =
            attachedIds.length === 0
                ? []
                : await tx
                      .select({
                          id: addonInstances.id,
                          name: addons.name,
                          scopeType: addonVersions.scopeType
                      })
                      .from(addonInstances)
                      .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
                      .innerJoin(addonVersions, eq(addonVersions.id, addonInstances.addonVersionId))
                      .innerJoin(addons, eq(addons.id, addonProducts.addonId))
                      .where(
                          and(
                              eq(addonInstances.ownerId, row.userId),
                              eq(addonInstances.status, 'ACTIVE'),
                              eq(addonProducts.chargeKind, 'PERIODICO'),
                              inArray(addonInstances.id, attachedIds)
                          )
                      );
        const vertical = candidates
            .filter(
                (candidate) =>
                    selectedIds.has(candidate.id) &&
                    (candidate.scopeType === 'LISTING' ||
                        candidate.scopeType === 'VERTICAL_SUBSCRIPTION')
            )
            .map((candidate) => candidate.name);
        const account = candidates
            .filter(
                (candidate) => candidate.scopeType === 'USER' || candidate.scopeType === 'GLOBAL'
            )
            .map((candidate) => ({ name: candidate.name, pauses: selectedIds.has(candidate.id) }));
        const expectedEndAtByMonths: Record<number, string> = {};
        for (let months = 1; months <= max; months++)
            expectedEndAtByMonths[months] = pauseExpectedEndAt(now, months).toISOString();
        return {
            offered: true,
            months: { min: 1, max },
            expectedEndAtByMonths,
            quota: { pausesLeft, monthsLeft },
            addons: { vertical, account },
            ...(courtesyGrant
                ? { courtesyForfeit: { endsAt: courtesyGrant.endsAt.toISOString() } }
                : {})
        };
    });
}
