import type { AuthorizationSnapshot } from '../provider/payment-provider';

/** Serializes a domain read into the resource shape returned by Mercado Pago. */
export function serializeAuthorization(args: {
    readonly snapshot: AuthorizationSnapshot;
    readonly initPoint: string;
}): Readonly<Record<string, unknown>> {
    const { snapshot } = args;
    return {
        id: snapshot.authorizationId,
        external_reference: snapshot.reference,
        status: snapshot.status === 'active' ? 'authorized' : snapshot.status,
        auto_recurring: {
            frequency: snapshot.cadence.everyMonths,
            frequency_type: 'months',
            transaction_amount: snapshot.amount.amountMinor / 100,
            currency_id: snapshot.amount.currency,
            ...(snapshot.firstChargeAt === null ? {} : { start_date: snapshot.firstChargeAt }),
            ...(snapshot.freePeriodDays === null
                ? {}
                : {
                      free_trial: {
                          frequency: snapshot.freePeriodDays,
                          frequency_type: 'days'
                      }
                  })
        },
        last_modified: snapshot.lastModifiedAt,
        next_payment_date: snapshot.nextChargeAt,
        summarized: {
            ...(snapshot.chargeRecordCount === null
                ? {}
                : { charged_quantity: snapshot.chargeRecordCount }),
            ...(snapshot.lastChargedAt === null
                ? {}
                : { last_charged_date: snapshot.lastChargedAt })
        },
        init_point: args.initPoint
    };
}
