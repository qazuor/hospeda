import {
    and,
    type DrizzleClient,
    eq,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { z } from 'zod';
import { type AddonScopeType, findOrphanhoodCandidates } from '../addon/addon-orphanhood.js';
import { permanentGrantLiveAnchors } from '../grant/permanent-grant-live-anchors.js';
import type { ComplementPolicyPorts } from './complement-ports.js';

/** Rule-specific exclusions for a supporting principal. */
export type ComplementRule = 'PAUSE' | 'CANCEL' | 'RESUME';
/** Status of the complement subscription selected by the caller. */
export type ComplementTargetStatus = 'ACTIVE' | 'PAUSED';
/** An active addon instance and its linked complement subscription. */
export interface ComplementTarget {
    readonly instanceId: string;
    readonly ownerId: string;
    readonly scopeType: AddonScopeType;
    readonly complementSubscriptionId: string;
    readonly authorizationId: string | null;
    readonly paymentMethod: string | null;
    readonly compatibleVerticals: readonly string[];
}

const inputSchema = z.strictObject({
    tx: z.custom<DrizzleClient>((value) => value !== null && value !== undefined),
    principal: z.strictObject({ id: z.uuid(), userId: z.uuid(), vertical: z.string().min(1) }),
    rule: z.enum(['PAUSE', 'CANCEL', 'RESUME']),
    complementStatus: z.enum(['ACTIVE', 'PAUSED']),
    onlyUserWide: z.boolean().optional()
});

const exclusionByRule: Readonly<Record<ComplementRule, readonly string[]>> = {
    PAUSE: ['PAUSED', 'SUSPENDED'],
    CANCEL: ['PAUSED', 'SUSPENDED', 'CANCEL_SCHEDULED'],
    RESUME: []
};

/** Selects only complement rows still attached to the specified principal's active instances. */
export async function selectComplementTargets(
    input: {
        readonly tx: DrizzleClient;
        readonly principal: {
            readonly id: string;
            readonly userId: string;
            readonly vertical: string;
        };
        readonly rule: ComplementRule;
        readonly complementStatus: ComplementTargetStatus;
        readonly onlyUserWide?: boolean;
    },
    ports: ComplementPolicyPorts
): Promise<{ readonly targets: readonly ComplementTarget[] }> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
        throw new Error(`Invalid complement selection input: ${parsed.error.message}`);
    const { tx, principal, rule, complementStatus, onlyUserWide } = parsed.data;
    const [principalRow] = await tx
        .select({
            id: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            class: subscriptions.class
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, principal.id))
        .limit(1);
    if (
        principalRow?.class !== 'PRINCIPAL' ||
        principalRow.userId !== principal.userId ||
        principalRow.vertical !== principal.vertical
    ) {
        throw new Error(`Principal ${principal.id} is missing or inconsistent`);
    }
    const principalUserId = principalRow.userId;
    if (!principalUserId) throw new Error(`Principal ${principal.id} has no user`);

    const { candidates } = await findOrphanhoodCandidates(
        {
            tx,
            leftRow: {
                id: principalRow.id,
                userId: principalRow.userId,
                vertical: principalRow.vertical,
                predecessorId: null
            }
        },
        { ...ports, payments: undefined }
    );
    const targets: ComplementTarget[] = [];
    for (const candidate of candidates) {
        if (
            candidate.status !== 'ACTIVE' ||
            candidate.ownerId !== principalRow.userId ||
            !candidate.complementSubscriptionId
        )
            continue;
        if (onlyUserWide && candidate.scopeType !== 'USER' && candidate.scopeType !== 'GLOBAL')
            continue;
        if (
            (candidate.scopeType === 'USER' || candidate.scopeType === 'GLOBAL') &&
            rule !== 'RESUME'
        ) {
            let supportedElsewhere = false;
            const anchors = ports.liveAnchors ?? permanentGrantLiveAnchors;
            for (const vertical of candidate.compatibleVerticals) {
                if (vertical === principalRow.vertical) continue;
                const exclusions = exclusionByRule[rule];
                const statuses = await tx
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(
                        and(
                            eq(subscriptions.userId, principalUserId),
                            eq(subscriptions.vertical, vertical),
                            eq(subscriptions.class, 'PRINCIPAL'),
                            inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
                        )
                    );
                // The selected principal rows are exactly the live-state inventory examined here.
                if (
                    statuses.some((principalStatus) => !exclusions.includes(principalStatus.status))
                )
                    supportedElsewhere = true;
                if (await anchors.hasLiveAnchor({ userId: principalUserId, vertical, tx }))
                    supportedElsewhere = true;
            }
            if (supportedElsewhere) continue;
        }
        const targetRows: {
            readonly id: string;
            readonly class: string;
            readonly userId: string | null;
            readonly status: string;
            readonly authorizationId: string | null;
            readonly paymentMethod: string | null;
        }[] = await tx
            .select({
                id: subscriptions.id,
                class: subscriptions.class,
                userId: subscriptions.userId,
                status: subscriptions.status,
                authorizationId: providerLinks.providerId,
                paymentMethod: subscriptions.paymentMethod
            })
            .from(subscriptions)
            .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(
                and(
                    eq(subscriptions.id, candidate.complementSubscriptionId),
                    eq(subscriptions.class, 'COMPLEMENTO'),
                    eq(subscriptions.userId, principalUserId),
                    eq(subscriptions.status, complementStatus)
                )
            )
            .limit(1);
        const row = targetRows[0];
        if (
            !row ||
            row.class === 'PRINCIPAL' ||
            row.userId !== principalRow.userId ||
            row.status !== complementStatus
        )
            continue;
        targets.push({
            instanceId: candidate.id,
            ownerId: candidate.ownerId,
            scopeType: candidate.scopeType,
            complementSubscriptionId: row.id,
            authorizationId: row.authorizationId,
            paymentMethod: row.paymentMethod,
            compatibleVerticals: candidate.compatibleVerticals
        });
    }
    return { targets };
}

/** Chooses the open pause end for a user-wide complement, or null when unbounded. */
export async function pauseEndForUserWide(input: {
    readonly tx: DrizzleClient;
    readonly userId: string;
    readonly compatibleVerticals: readonly string[];
    readonly exceptVertical: string;
}): Promise<Date | null> {
    const parsed = z
        .strictObject({
            tx: z.custom<DrizzleClient>((value) => value !== null && value !== undefined),
            userId: z.uuid(),
            compatibleVerticals: z.array(z.string().min(1)),
            exceptVertical: z.string().min(1)
        })
        .safeParse(input);
    if (!parsed.success) throw new Error(`Invalid user-wide pause input: ${parsed.error.message}`);
    const ends: Date[] = [];
    for (const vertical of parsed.data.compatibleVerticals) {
        if (vertical === parsed.data.exceptVertical) continue;
        const rows = await input.tx
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.userId, parsed.data.userId),
                    eq(subscriptions.vertical, vertical),
                    eq(subscriptions.class, 'PRINCIPAL')
                )
            );
        if (rows.some((row) => row.status === 'SUSPENDED')) return null;
        for (const row of rows) {
            if (row.status !== 'PAUSED') continue;
            const [pause] = await input.tx
                .select({ expectedEndAt: subscriptionPauses.expectedEndAt })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, row.id),
                        eq(subscriptionPauses.reason, 'CUSTOMER_REQUEST'),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                )
                .limit(1);
            if (pause && pause.expectedEndAt === null) return null;
            if (pause?.expectedEndAt) ends.push(pause.expectedEndAt);
        }
    }
    return ends.length ? new Date(Math.max(...ends.map((date) => date.getTime()))) : null;
}
