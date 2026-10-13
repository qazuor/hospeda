import { randomUUID } from 'node:crypto';
import {
    accountClosureModel,
    type DrizzleClient,
    domainEventModel,
    getDb,
    isPseudonymizedEmail,
    type LockedClosureApplication,
    userModel
} from '@repo/db';
import {
    type PartnerApplicationEmailReplacementPreview,
    PartnerApplicationEmailReplacementPreviewSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { getRequestCorrelationId } from '../../lib/request-context';
import { getClock } from '../../utils/clock';
import { apiLogger } from '../../utils/logger';
import { assertAction24Step3 } from './account-closure-step3';
import {
    permissionsActorLacks,
    readSubjectEffectivePermissions,
    SUBJECT_OUTRANKS_ACTOR
} from './account-closure-subject-permissions';

/**
 * `error.reason` of the 409 when a live account carries the application's
 * mailbox (H15): that mailbox is replaced by closing the ACCOUNT, with its
 * preconditions, never through the application route.
 */
export const APPLICATION_HAS_ACCOUNT = 'APPLICATION_HAS_ACCOUNT' as const;

/** The application as action 24 sees it once its row is locked and the actor is cleared. */
interface LockedApplicationRead {
    readonly application: LockedClosureApplication;
    readonly liveAccountId: string | null;
}

/**
 * Administrative action 24 (ACC:24) over a partner application made WITHOUT an
 * account (AC:V8a:12): a person who applied as a partner without an account asks
 * that their mailbox be deleted, and support replaces it, with a mandatory
 * reason and an audit event whose subject is the application (identified by its
 * mailbox).
 *
 * Step 3 is the SAME as the account closure ({@link assertAction24Step3}), with
 * `subjectId: null`: the subject is not an account. `actor = subject` is then
 * decided by mailbox, inside the transaction (H15): an admin whose own mailbox is
 * the application's is refused with 403.
 *
 * The account preconditions (`puedeCobrarle`, listings, partner presence) are NOT
 * evaluated, because there is no account: this service never calls `canCharge`
 * and reads no listing and no presence. So that it cannot become a shortcut
 * around them, an application whose mailbox belongs to a live account is refused
 * with 409 {@link APPLICATION_HAS_ACCOUNT} (that mailbox goes with the account's
 * own closure), after the hierarchy check of the account closure (403
 * `SUBJECT_OUTRANKS_ACTOR` when that account holds a permission the actor
 * lacks), so the 409 never tells a less privileged actor more than the closure
 * would.
 *
 * Everything that decides is read inside the one transaction that writes, after
 * the application row is locked (`FOR UPDATE`, Coord-182). A refusal throws
 * inside it, so nothing is written, not even the event. The event stores only
 * the field NAME (`email`), never the old mailbox (H5: the log is append-only).
 */
export class ApplicationEmailReplacementService {
    /**
     * The read that precedes the replacement: which application's mailbox it is
     * (id, current mailbox, status and creation date), read under the same lock
     * and refusals as the replacement, writing nothing.
     *
     * @throws {ServiceError} FORBIDDEN at step 3, for `actor = subject` by mailbox
     *   or when the live account carrying the mailbox outranks the actor;
     *   NOT_FOUND for a missing or already replaced application.
     */
    async previewApplication(input: {
        readonly actor: Actor;
        readonly applicationId: string;
    }): Promise<PartnerApplicationEmailReplacementPreview> {
        assertAction24Step3({ actor: input.actor, subjectId: null });
        const { application } = await getDb().transaction(async (rawTx) =>
            this.readLockedApplication({
                tx: rawTx as DrizzleClient,
                actor: input.actor,
                applicationId: input.applicationId
            })
        );
        return PartnerApplicationEmailReplacementPreviewSchema.parse({
            applicationId: application.id,
            email: application.email,
            status: application.status,
            createdAt: application.createdAt.toISOString()
        });
    }

    /**
     * Replaces the mailbox of a partner application made without an account
     * (AC:V8a:12), in ONE transaction: lock, refusals, the pseudonymising write
     * and the `partner_application.email_replaced` event.
     *
     * @throws {ServiceError} FORBIDDEN at step 3, for `actor = subject` by mailbox
     *   or when the live account carrying the mailbox outranks the actor;
     *   VALIDATION_ERROR for a blank reason; NOT_FOUND for a missing or already
     *   replaced application; ALREADY_EXISTS (409, `APPLICATION_HAS_ACCOUNT`) when
     *   a live account carries the mailbox.
     */
    async replaceApplicationEmailOnRequest(input: {
        readonly actor: Actor;
        readonly applicationId: string;
        readonly reason: string;
    }): Promise<{ replaced: true }> {
        assertAction24Step3({ actor: input.actor, subjectId: null });
        const reason = input.reason.trim();
        if (reason.length === 0) {
            throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason required');
        }
        const { actor, applicationId } = input;
        const at = getClock().clock.now();
        const correlationId = getRequestCorrelationId() ?? randomUUID();

        await getDb().transaction(async (rawTx) => {
            const tx = rawTx as DrizzleClient;
            const read = await this.readLockedApplication({ tx, actor, applicationId });
            if (read.liveAccountId !== null) {
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'The mailbox belongs to a live account: close the account instead',
                    undefined,
                    APPLICATION_HAS_ACCOUNT
                );
            }
            await accountClosureModel.replaceApplicationEmail({ tx, applicationId, at });
            await domainEventModel.insert({
                tx,
                eventType: 'partner_application.email_replaced',
                entityType: 'partner_application',
                entityId: applicationId,
                actorType: 'admin',
                actorId: actor.id,
                reason,
                correlationId,
                occurredAt: at,
                changes: [{ field: 'email' }]
            });
        });

        apiLogger.info(
            { applicationId, actorId: actor.id },
            'Partner application email replaced on request (ACC:24)'
        );
        return { replaced: true };
    }

    /**
     * The decision reads, in order, inside the caller's transaction: the
     * application row (`FOR UPDATE`; missing or already pseudonymised → 404),
     * the actor's own mailbox (`actor = subject` → 403; an actor without a row
     * fails closed with 403), and the live account carrying the mailbox, whose
     * effective permissions must all be held by the actor (403
     * `SUBJECT_OUTRANKS_ACTOR`, Coord-235).
     */
    private async readLockedApplication(input: {
        readonly tx: DrizzleClient;
        readonly actor: Actor;
        readonly applicationId: string;
    }): Promise<LockedApplicationRead> {
        const { tx, actor, applicationId } = input;
        const application = await accountClosureModel.lockApplication({ tx, applicationId });
        if (!application || isPseudonymizedEmail({ email: application.email })) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner application not found');
        }
        const actorRow = await userModel.findById(actor.id, tx);
        if (!actorRow || actorRow.email.toLowerCase() === application.email.toLowerCase()) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        }
        const liveAccountId = await accountClosureModel.findLiveAccountIdByEmail({
            tx,
            email: application.email
        });
        if (liveAccountId !== null) {
            const subject = await readSubjectEffectivePermissions({ tx, userId: liveAccountId });
            const outranked = permissionsActorLacks({
                subjectPermissions: subject.permissions,
                actorPermissions: actor.permissions
            });
            if (outranked.missing.length > 0) {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Forbidden',
                    undefined,
                    SUBJECT_OUTRANKS_ACTOR
                );
            }
        }
        return { application, liveAccountId };
    }
}
