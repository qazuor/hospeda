/**
 * Every mutation is confirmed by re-reading and comparing field by field
 * (AC:B1:3, INV:D5).
 *
 * A provider can answer success to a mutation and not apply it, and a request
 * that changes several fields can be applied by halves under a single success
 * (measured: EX-20). So the acknowledgement closes nothing: the caller re-reads
 * the resource by id and compares EACH field it sent. One field that did not
 * land makes the whole mutation failed, and the result names it; the fields
 * that did land are not hidden by it either.
 */
import { z } from 'zod';
import type {
    AuthorizationSnapshot,
    MutationAcknowledgement,
    PaymentProvider
} from './payment-provider';
import type { ProviderRead } from './provider-read';
import { MoneySchema } from './schemas';

/** The fields of an authorization a mutation can change. */
export type AuthorizationMutableField = 'status' | 'amount' | 'cadence';

/** What a mutation asked for, field by field: at least one field. */
export type SentAuthorizationFields = Partial<
    Pick<AuthorizationSnapshot, AuthorizationMutableField>
>;

/** One field the provider acknowledged and did not apply. */
export interface UnappliedField {
    readonly field: AuthorizationMutableField;
    /** What the mutation sent. */
    readonly sent: unknown;
    /** What the re-read by id found instead. */
    readonly read: unknown;
}

/**
 * The verdict of the re-read. `notApplied` IS a failed mutation, whatever the
 * provider answered.
 */
export type AuthorizationMutationConfirmation =
    | {
          readonly outcome: 'applied';
          readonly read: ProviderRead<AuthorizationSnapshot>;
      }
    | {
          readonly outcome: 'notApplied';
          readonly unapplied: readonly UnappliedField[];
          readonly read: ProviderRead<AuthorizationSnapshot>;
      };

const SentAuthorizationFieldsSchema = z
    .strictObject({
        status: z.enum(['pending', 'active', 'paused', 'cancelled']).optional(),
        amount: MoneySchema.optional(),
        cadence: z.strictObject({ everyMonths: z.number().int().min(1).max(12) }).optional()
    })
    .refine((sent) => Object.values(sent).some((value) => value !== undefined), {
        message: 'a mutation sends at least one field'
    });

const AcknowledgementSchema = z.strictObject({
    accepted: z.literal(true),
    resourceId: z.string().trim().min(1)
});

/** Field order of the comparison, so the verdict is deterministic. */
const MUTABLE_FIELDS: readonly AuthorizationMutableField[] = ['status', 'amount', 'cadence'];

/** Structural equality of the plain values a snapshot holds (strings, numbers, flat objects). */
function sameValue(input: { readonly a: unknown; readonly b: unknown }): boolean {
    const { a, b } = input;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return Object.is(a, b);
    }
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length || keysA.some((key, index) => key !== keysB[index])) {
        return false;
    }
    return keysA.every((key) =>
        sameValue({
            a: (a as Record<string, unknown>)[key],
            b: (b as Record<string, unknown>)[key]
        })
    );
}

/**
 * Confirms a mutation on an authorization by re-reading it by id and comparing
 * every field that was sent. Never trusts the acknowledgement.
 *
 * @param input.provider - Where to re-read from
 * @param input.acknowledgement - What the provider answered to the mutation
 * @param input.sent - Every field the mutation asked for, with its value
 * @returns `applied` only when every sent field reads back as sent; otherwise
 *   `notApplied`, naming each field that did not land
 * @throws ZodError when `sent` is empty or malformed, or the acknowledgement is malformed
 * @throws PaymentProviderError when the re-read itself fails
 */
export async function confirmAuthorizationMutation(input: {
    readonly provider: Pick<PaymentProvider, 'readAuthorization'>;
    readonly acknowledgement: MutationAcknowledgement;
    readonly sent: SentAuthorizationFields;
}): Promise<AuthorizationMutationConfirmation> {
    const acknowledgement = AcknowledgementSchema.parse(input.acknowledgement);
    const sent = SentAuthorizationFieldsSchema.parse(input.sent);

    const read = await input.provider.readAuthorization({
        authorizationId: acknowledgement.resourceId
    });

    const unapplied = MUTABLE_FIELDS.flatMap((field): UnappliedField[] => {
        const sentValue = sent[field];
        if (sentValue === undefined) return [];
        const readValue = read.snapshot[field];
        return sameValue({ a: sentValue, b: readValue })
            ? []
            : [{ field, sent: sentValue, read: readValue }];
    });

    return unapplied.length === 0
        ? { outcome: 'applied', read }
        : { outcome: 'notApplied', unapplied, read };
}
