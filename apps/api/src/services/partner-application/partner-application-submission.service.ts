import { getDb, partnerApplicationModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import {
    classifyPartnerApplicationInsertError,
    PARTNER_APPLICATION_PENDING,
    PARTNER_APPLICATION_UNAVAILABLE,
    PARTNER_APPLICATION_WAIT_ACTIVE
} from './partner-application-errors';

const NOT_ACCEPTED_MESSAGE = 'Partner application not accepted';

/**
 * Creates a pending Partner application. A database guard that refuses it becomes a 409 whose
 * reason says which one: a pending application, or the wait after a rejection with its end date.
 */
export async function submitPartnerApplication({
    email
}: {
    readonly email: string;
}): Promise<{ readonly submitted: true }> {
    try {
        await getDb().transaction(async (rawTx) => {
            await partnerApplicationModel.insertPending({ tx: rawTx, email });
        });
        return { submitted: true };
    } catch (error) {
        const classification = classifyPartnerApplicationInsertError({ error });
        if (classification === 'PENDING_EXISTS') {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                NOT_ACCEPTED_MESSAGE,
                undefined,
                PARTNER_APPLICATION_PENDING
            );
        }
        if (classification === 'WAIT_ACTIVE') {
            const reapplyAfter = await getDb().transaction(async (tx) =>
                partnerApplicationModel.readActiveWaitReapplyAfter({ tx, email })
            );
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                NOT_ACCEPTED_MESSAGE,
                reapplyAfter ? { reapplyAfter: reapplyAfter.toISOString() } : undefined,
                reapplyAfter ? PARTNER_APPLICATION_WAIT_ACTIVE : PARTNER_APPLICATION_UNAVAILABLE
            );
        }
        throw error;
    }
}
