import type { ListingResponse, VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonVersions,
    and,
    type DrizzleClient,
    emailOutbox,
    eq,
    inArray,
    isNull,
    providerLinks,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import type { ComplementPolicyPorts } from '../../../../src/services/billing/subscription/complement-ports.js';
import { getServiceTestDb } from '../helpers.js';
import {
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal
} from './addon-orphan-fixtures.js';

const owners: string[] = [];
const subscriptionIds: string[] = [];
const instanceIds: string[] = [];
export const complementNow = new Date('2026-10-14T12:00:00.000Z');

/** Seeds one committed principal and one linked recurring complement with a real fake-provider authorization. */
export async function seedCommittedComplement(input: {
    readonly fake: FakePaymentProvider;
    readonly principalStatus: string;
    readonly principal?: { readonly userId: string; readonly principalId: string };
    readonly scopeType?: 'VERTICAL_SUBSCRIPTION' | 'LISTING' | 'USER' | 'GLOBAL';
    readonly scopeTypes?: readonly ('VERTICAL_SUBSCRIPTION' | 'LISTING' | 'USER' | 'GLOBAL')[];
    readonly otherStatus?: string;
    readonly complementStatus?: string;
    readonly withLink?: boolean;
    readonly openPause?: boolean;
}): Promise<{
    readonly userId: string;
    readonly principalId: string;
    readonly otherPrincipalId: string | null;
    readonly complementId: string;
    readonly instanceId: string;
    readonly authorizationId: string | null;
    readonly addons: readonly {
        readonly complementId: string;
        readonly instanceId: string;
        readonly authorizationId: string | null;
    }[];
    readonly policy: ComplementPolicyPorts;
}> {
    const scopeTypes = input.scopeTypes ?? (input.scopeType ? [input.scopeType] : []);
    if (scopeTypes.length === 0) throw new Error('At least one complement scope is required');
    const authorizationIds: string[] = [];
    for (let index = 0; index < scopeTypes.length; index += 1) {
        const authorization = await input.fake.authorize({
            reference: `complement-${crypto.randomUUID()}`,
            amount: { amountMinor: 500000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'recurring complement test',
            returnUrl: 'https://example.test/return',
            payerEmail: `complement-${crypto.randomUUID()}@example.test`
        });
        await input.fake.approve({ authorizationId: authorization.authorizationId });
        authorizationIds.push(authorization.authorizationId);
    }
    const listingRows = new Map<string, ListingResponse>();
    const db = getServiceTestDb();
    const seeded = await db.transaction(async (raw) => {
        const tx = raw as unknown as DrizzleClient;
        const userId = input.principal?.userId ?? (await seedOrphanOwner(tx)).userId;
        const principal = input.principal
            ? { subscriptionId: input.principal.principalId }
            : await seedPrincipal(tx, {
                  userId,
                  vertical: 'accommodation',
                  status: input.principalStatus
              });
        const other = input.otherStatus
            ? await seedPrincipal(tx, { userId, vertical: 'gastronomy', status: input.otherStatus })
            : null;
        const addons = [];
        for (const [index, scopeType] of scopeTypes.entries()) {
            const complement = await seedComplement(tx, {
                userId,
                vertical: 'accommodation',
                status: input.complementStatus ?? 'ACTIVE',
                withLink: false,
                openPause: input.openPause
            });
            const targetId =
                scopeType === 'VERTICAL_SUBSCRIPTION'
                    ? principal.subscriptionId
                    : scopeType === 'LISTING'
                      ? crypto.randomUUID()
                      : null;
            if (scopeType === 'LISTING' && targetId)
                listingRows.set(targetId, {
                    vertical: VerticalEnum.ACCOMMODATION,
                    ownerId: userId,
                    acceptsFeature: true
                });
            const addon = await seedOrphanInstance(tx, {
                ownerId: userId,
                scopeType,
                compatibleVerticals: ['accommodation', 'gastronomy'],
                status: 'ACTIVE',
                targetId,
                complementSubscriptionId: complement.subscriptionId
            });
            const authorizationId = authorizationIds[index];
            if (!authorizationId) throw new Error('Provider authorization was not seeded');
            if (input.withLink ?? true)
                await tx.insert(providerLinks).values({
                    subscriptionId: complement.subscriptionId,
                    provider: 'MERCADO_PAGO',
                    providerId: authorizationId
                });
            addons.push({
                complementId: complement.subscriptionId,
                instanceId: addon.instanceId,
                authorizationId: input.withLink === false ? null : authorizationId
            });
            subscriptionIds.push(complement.subscriptionId);
            instanceIds.push(addon.instanceId);
        }
        owners.push(userId);
        subscriptionIds.push(
            ...(input.principal ? [] : [principal.subscriptionId]),
            ...(other ? [other.subscriptionId] : [])
        );
        return {
            userId,
            principalId: principal.subscriptionId,
            otherPrincipalId: other?.subscriptionId ?? null,
            complementId: addons[0]?.complementId ?? '',
            instanceId: addons[0]?.instanceId ?? '',
            authorizationId: addons[0]?.authorizationId ?? null,
            addons
        };
    });
    const policy: ComplementPolicyPorts = {
        addonPolicy: async ({ addonVersionId }): ReturnType<VerticalsForBilling['addonPolicy']> => {
            const [version] = await getServiceTestDb()
                .select()
                .from(addonVersions)
                .where(eq(addonVersions.id, addonVersionId));
            if (!version) throw new Error('addon version missing');
            return {
                addonId: version.addonId,
                validity: version.validity,
                validityDays: version.validityDays,
                scopeType: version.scopeType
            };
        },
        listing: async ({ listingId }) => {
            const listing = listingRows.get(listingId);
            if (!listing) throw new Error('listing policy was not configured');
            return listing;
        },
        liveAnchors: { hasLiveAnchor: async () => false }
    };
    return { ...seeded, policy };
}

/** Cleans every committed fixture row, open mark and owner outbox message after an integration test. */
export async function retireComplementRows(): Promise<void> {
    const db = getServiceTestDb();
    const instances = instanceIds.splice(0);
    const subs = subscriptionIds.splice(0);
    const people = owners.splice(0);
    if (instances.length)
        await db
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(inArray(addonInstances.id, instances));
    if (subs.length) {
        await db.delete(subscriptionPauses).where(inArray(subscriptionPauses.subscriptionId, subs));
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.id, subs));
        const actorId = people[0];
        if (actorId)
            await db
                .update(reconciliationMarks)
                .set({ liftedAt: complementNow, liftedBy: actorId })
                .where(
                    and(
                        inArray(reconciliationMarks.subscriptionId, subs),
                        isNull(reconciliationMarks.liftedAt)
                    )
                );
    }
    if (people.length)
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, people));
}

/** Fake provider proxy supporting deterministic pause and read failures. */
export function providerHarness(
    options: {
        readonly pauseAcknowledgesOnly?: boolean;
        readonly resumeAcknowledgesOnly?: boolean;
        readonly resumeThrows?: boolean;
        readonly onResume?: () => Promise<void>;
        readonly pauseThrows?: boolean;
        readonly readThrows?: boolean;
        readonly onPause?: () => Promise<void>;
    } = {}
) {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: { now: () => complementNow }
    });
    const calls: string[] = [];
    const provider = new Proxy(fake as unknown as PaymentProvider, {
        get(target, property, receiver) {
            if (property === 'resume')
                return async (input: { readonly authorizationId: string }) => {
                    calls.push(`resume:${input.authorizationId}`);
                    if (options.resumeThrows) throw new Error('resume failed');
                    if (options.resumeAcknowledgesOnly)
                        return { accepted: true as const, resourceId: input.authorizationId };
                    await options.onResume?.();
                    return fake.resume(input);
                };
            if (property === 'pause')
                return async (input: { readonly authorizationId: string }) => {
                    calls.push(input.authorizationId);
                    if (options.pauseThrows) throw new Error('pause failed');
                    if (options.pauseAcknowledgesOnly)
                        return { accepted: true as const, resourceId: input.authorizationId };
                    await options.onPause?.();
                    return fake.pause(input);
                };
            if (property === 'readAuthorization' && options.readThrows)
                return async () => {
                    throw new Error('read failed');
                };
            const method = Reflect.get(target, property, receiver);
            return typeof method === 'function' ? method.bind(target) : method;
        }
    });
    return { fake, provider, calls };
}
