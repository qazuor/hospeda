/** Confirm an authorization's creation by reading its stored fields by id (AC:B3:42). */
import { z } from 'zod';
import type { AuthorizationSnapshot, AuthorizeInput, PaymentProvider } from './payment-provider';
import type { ProviderRead } from './provider-read';
import { AuthorizeInputSchema } from './schemas';

/** Fields sent at creation that can be confirmed by a provider read. */
export type AuthorizationCreationField = 'reference' | 'amount' | 'cadence' | 'firstChargeAt';

/** One creation field whose readback differs from what was sent. */
export interface UnappliedCreationField {
    readonly field: AuthorizationCreationField;
    readonly sent: unknown;
    readonly read: unknown;
}

/** Confirmation of the created authorization, including the read used for the decision. */
export type AuthorizationCreationConfirmation =
    | { readonly outcome: 'applied'; readonly read: ProviderRead<AuthorizationSnapshot> }
    | {
          readonly outcome: 'notApplied';
          readonly unapplied: readonly UnappliedCreationField[];
          readonly read: ProviderRead<AuthorizationSnapshot>;
      };

const CREATION_FIELDS: readonly AuthorizationCreationField[] = [
    'reference',
    'amount',
    'cadence',
    'firstChargeAt'
];

/** Compare the simple domain values without treating a provider acknowledgement as evidence. */
function sameField(args: { readonly sent: unknown; readonly read: unknown }): boolean {
    if (typeof args.sent !== 'object' || args.sent === null) return Object.is(args.sent, args.read);
    if (typeof args.read !== 'object' || args.read === null) return false;
    const sent = args.sent as Record<string, unknown>;
    const read = args.read as Record<string, unknown>;
    const keys = Object.keys(sent);
    return (
        keys.length === Object.keys(read).length &&
        keys.every((key) => Object.is(sent[key], read[key]))
    );
}

/**
 * Re-read a newly created authorization by id and compare every sent field.
 * The provider's added free period is deliberately outside this verdict: it
 * cannot establish our own trial state (D12, G11).
 */
export async function confirmAuthorizationCreation(input: {
    readonly provider: Pick<PaymentProvider, 'readAuthorization'>;
    readonly authorizationId: string;
    readonly sent: AuthorizeInput;
}): Promise<AuthorizationCreationConfirmation> {
    const authorizationId = z.string().trim().min(1).parse(input.authorizationId);
    const sent = AuthorizeInputSchema.parse(input.sent);
    const read = await input.provider.readAuthorization({ authorizationId });
    const unapplied = CREATION_FIELDS.flatMap((field): UnappliedCreationField[] => {
        const sentValue = sent[field];
        if (sentValue === undefined) return [];
        const readValue = read.snapshot[field];
        return sameField({ sent: sentValue, read: readValue })
            ? []
            : [{ field, sent: sentValue, read: readValue }];
    });
    return unapplied.length === 0
        ? { outcome: 'applied', read }
        : { outcome: 'notApplied', unapplied, read };
}
