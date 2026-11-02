import { getDb, partnerApplicationModel } from '@repo/db';
import { ServiceError, ServiceErrorCode } from '@repo/service-core';
import {
    classifyPartnerApplicationInsertError,
    PARTNER_APPLICATION_UNAVAILABLE
} from './partner-application-errors';

/** Creates a pending Partner application, translating database guards to one opaque conflict. */
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
        if (classification !== null) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Partner application not accepted',
                undefined,
                PARTNER_APPLICATION_UNAVAILABLE
            );
        }
        throw error;
    }
}
