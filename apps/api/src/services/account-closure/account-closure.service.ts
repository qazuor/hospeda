import { randomUUID } from 'node:crypto';
import {
    type BillingForVerticals,
    CanChargeResponseSchema
} from '@repo/billing-verticals-contract';
import {
    ACCOUNT_CLOSURE_PERSONAL_FIELDS,
    accountClosureModel,
    type DrizzleClient,
    domainEventModel,
    getDb,
    listingPublicationModel
} from '@repo/db';
import { type AccountClosurePreview, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { type Actor, isSystemActor, ServiceError } from '@repo/service-core';
import {
    isAdministrativeActionPermitted,
    resolveAdministrativeActionStep,
    trialMachineLockKey
} from '@repo/verticals';
import { getRequestCorrelationId } from '../../lib/request-context';
import { getClock } from '../../utils/clock';
import { getListingAccessPorts } from '../../utils/listing-access/ports';
import { apiLogger } from '../../utils/logger';
import {
    ACCOUNT_CLOSURE_REJECTION_MESSAGES,
    type AccountClosurePreconditions,
    selectAccountClosureRejection
} from './account-closure-rejection';

/**
 * The three listing verticals whose trial-machine lock action 24 takes, in this
 * fixed order (accommodation, gastronomy, experience): the same order every
 * closure uses, so two of them never wait on each other crosswise.
 */
const LISTING_LOCK_VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;

/** The account, as action 24 sees it once it holds every lock. */
interface LockedPreconditions extends AccountClosurePreconditions {
    readonly email: string;
    readonly displayName: string | null;
}

/**
 * Administrative action 24 (ACC:24, `NUCLEO/08` §3), «dar de baja una cuenta a
 * pedido de su dueño»: the third and last step of the manual account closure,
 * run by support with a mandatory reason. The account row is NOT deleted: it is
 * pseudonymised (name, mailbox and phones replaced, `slug` regenerated), stamped
 * with `deleted_at`, and left without sessions and without credentials (every
 * `account` row is deleted), so it has no authenticated actor at step 1.
 *
 * It is a capability of the ACTOR (DEC-RF-008📌4): steps 5 to 7 are NOT evaluated
 * on the subject. Step 3 runs first, before any read, and derives `permitted`
 * only from this action's own permission (`isAdministrativeActionPermitted` with
 * `ACC_24`); a system actor, an actor without it, and an actor closing their own
 * account are refused with 403.
 *
 * Everything that decides is re-read and LOCKED inside the one transaction that
 * writes, in this order (H8, TOCTOU, Coord-182): the account row (`FOR UPDATE`),
 * the three trial-machine locks shared with PB1 and PB12, the listings outside
 * `PURGED` and the partner presence (`FOR UPDATE`), and only then `canCharge`.
 * A refusal throws inside the transaction, so nothing is written, not even the
 * audit event. The preview (`GET`) runs the very same reads and writes nothing;
 * it informs and never decides for the closure.
 *
 * It does NOT touch the audit log (actor and subject stay by id), payments, the
 * payer name and mailbox copied on each receipt, nor the `trial` row with its
 * pseudonym (DEC-DATA-005📌5). The audit event carries only the NAMES of the
 * personal fields it replaced, never their old values (H5): the log is
 * append-only.
 *
 * `canCharge` is the ONLY billing read (H7): no billing table is read here.
 * Residue (H8): billing answers `canCharge` outside its own transaction, so a
 * subscription born in the milliseconds between that answer and the commit
 * would land on an already closed account; the real `puedeCobrarle` (B4.3) and
 * the subscription start (B3) close that window.
 */
export class AccountClosureService {
    private readonly billing: Pick<BillingForVerticals, 'canCharge'> | undefined;

    /**
     * @param input.billing - The `canCharge` port; defaults, on each call, to the
     *   production listing-access billing port.
     */
    constructor(input: { readonly billing?: Pick<BillingForVerticals, 'canCharge'> } = {}) {
        this.billing = input.billing;
    }

    /**
     * The read that precedes action 24: whose account it is (current name and
     * mailbox) and its three preconditions, read with the same locks as the
     * closure inside a transaction that writes nothing.
     *
     * @throws {ServiceError} FORBIDDEN at step 3 or for a system account;
     *   NOT_FOUND for a missing or already closed account.
     */
    async preview(input: {
        readonly actor: Actor;
        readonly userId: string;
    }): Promise<AccountClosurePreview> {
        this.assertStep3(input);
        const read = await getDb().transaction(async (rawTx) =>
            this.readLockedPreconditions({ tx: rawTx as DrizzleClient, userId: input.userId })
        );
        return {
            userId: input.userId,
            displayName: read.displayName,
            email: read.email,
            canCharge: read.canCharge,
            listingsNotPurged: read.listingsNotPurged,
            partnerPresenceWithContent: read.partnerPresenceWithContent,
            ready:
                !read.canCharge && read.listingsNotPurged === 0 && !read.partnerPresenceWithContent
        };
    }

    /**
     * Closes the account at its owner's request (AC:V8a:10, AC:V8a:11), in ONE
     * transaction: locks, preconditions, `canCharge`, the pseudonymising write,
     * the `account.closed_on_request` event and one
     * `partner_application.email_replaced` event per replaced application.
     *
     * @throws {ServiceError} FORBIDDEN at step 3 or for a system account;
     *   VALIDATION_ERROR for a blank reason; NOT_FOUND for a missing or already
     *   closed account; ALREADY_EXISTS (409) with `reason` naming the first
     *   missing manual step when something still blocks.
     */
    async closeOnRequest(input: {
        readonly actor: Actor;
        readonly userId: string;
        readonly reason: string;
    }): Promise<{ closed: true }> {
        this.assertStep3(input);
        const reason = input.reason.trim();
        if (reason.length === 0) {
            throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason required');
        }
        const { actor, userId } = input;
        const at = getClock().clock.now();
        const correlationId = getRequestCorrelationId() ?? randomUUID();

        const written = await getDb().transaction(async (rawTx) => {
            const tx = rawTx as DrizzleClient;
            const read = await this.readLockedPreconditions({ tx, userId });
            const rejection = selectAccountClosureRejection(read).reason;
            if (rejection !== null) {
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    ACCOUNT_CLOSURE_REJECTION_MESSAGES[rejection],
                    {
                        canCharge: read.canCharge,
                        listingsNotPurged: read.listingsNotPurged,
                        partnerPresenceWithContent: read.partnerPresenceWithContent
                    },
                    rejection
                );
            }
            const closed = await accountClosureModel.closeAccount({
                tx,
                userId,
                actorId: actor.id,
                at
            });
            await domainEventModel.insert({
                tx,
                eventType: 'account.closed_on_request',
                entityType: 'user',
                entityId: userId,
                actorId: actor.id,
                actorType: 'admin',
                reason,
                correlationId,
                occurredAt: at,
                changes: [
                    ...ACCOUNT_CLOSURE_PERSONAL_FIELDS.map((field) => ({ field })),
                    { field: 'accounts', new: closed.deletedAccounts },
                    { field: 'sessions', new: closed.deletedSessions }
                ]
            });
            for (const applicationId of closed.replacedApplicationIds) {
                await domainEventModel.insert({
                    tx,
                    eventType: 'partner_application.email_replaced',
                    entityType: 'partner_application',
                    entityId: applicationId,
                    actorId: actor.id,
                    actorType: 'admin',
                    reason,
                    correlationId,
                    occurredAt: at,
                    changes: [{ field: 'email' }]
                });
            }
            return closed;
        });

        apiLogger.info(
            {
                userId,
                actorId: actor.id,
                deletedAccounts: written.deletedAccounts,
                deletedSessions: written.deletedSessions,
                deletedVerifications: written.deletedVerifications,
                replacedApplications: written.replacedApplicationIds.length
            },
            'Account closed on request (ACC:24)'
        );
        return { closed: true };
    }

    /**
     * Step 3 of action 24, before any read (error contract: permission 403 before
     * existence 404). `permitted` comes ONLY from this action's own permission,
     * and the same `action` goes to the resolver (Coord-174, Coord-178).
     */
    private assertStep3(input: { readonly actor: Actor; readonly userId: string }): void {
        const action = 'ACC_24' as const;
        const permitted = isAdministrativeActionPermitted({
            action,
            actorPermissions: input.actor.permissions
        });
        const step = resolveAdministrativeActionStep({
            action,
            actorId: input.actor.id,
            subjectId: input.userId,
            permitted,
            isSystemActor: isSystemActor(input.actor)
        });
        if (!step.allowed) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
    }

    /**
     * The decision reads, in the order that closes the TOCTOU (H8): the account
     * row, the three trial-machine locks, the listings, the presence, and only
     * then `canCharge`, all inside the caller's transaction.
     */
    private async readLockedPreconditions(input: {
        readonly tx: DrizzleClient;
        readonly userId: string;
    }): Promise<LockedPreconditions> {
        const { tx, userId } = input;
        const account = await accountClosureModel.lockAccount({ tx, userId });
        if (!account || account.deletedAt !== null) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
        }
        if (account.isSystemAccount) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        }
        for (const vertical of LISTING_LOCK_VERTICALS) {
            await listingPublicationModel.lock({
                tx,
                key: trialMachineLockKey({ userId, vertical }).key
            });
        }
        const listings = await accountClosureModel.lockListingsNotPurged({ tx, ownerId: userId });
        const presence = await accountClosureModel.lockPartnerPresence({
            tx,
            ownerUserId: userId
        });
        const billing = this.billing ?? getListingAccessPorts().billing;
        const charge = CanChargeResponseSchema.parse(await billing.canCharge({ userId }));
        return {
            email: account.email,
            displayName: account.displayName,
            canCharge: charge.canCharge,
            listingsNotPurged: listings.length,
            partnerPresenceWithContent: presence?.hasContent === true
        };
    }
}
