import {
    type ActStart,
    type AuthorizationSnapshot,
    actStartInstant,
    assertFreshForAct,
    type PaymentProvider,
    type ProviderRead
} from '@repo/payments';
import { readListedCharges } from './comparisons/listed-charges.js';

export interface LastCycleCharge {
    readonly createdAt: string;
    readonly expiresAt: string | null;
    readonly status: string;
    readonly purpose: string;
}

export function lastCycleRecordIsOpen(input: {
    readonly charges: ReadonlyArray<LastCycleCharge>;
    readonly complete: boolean;
    readonly actStartedAt: number;
}): boolean {
    if (!input.complete) return true;
    const charges = input.charges.filter((charge) => charge.purpose === 'charge');
    if (charges.length === 0) return false;
    const latest = charges.reduce((current, candidate) =>
        Date.parse(candidate.createdAt) >= Date.parse(current.createdAt) ? candidate : current
    );
    if (latest.status === 'pending') return true;
    if (latest.status === 'approved') return false;
    if (latest.status === 'rejected') {
        return latest.expiresAt === null || Date.parse(latest.expiresAt) > input.actStartedAt;
    }
    return false;
}

export async function readLastCycleRecordIsOpen(
    input: {
        readonly authorizationRead: ProviderRead<AuthorizationSnapshot>;
        readonly act: ActStart;
    },
    ports: { readonly provider: PaymentProvider }
): Promise<boolean> {
    const { complete, charges } = await readListedCharges(input, ports);
    const actStartedAt = actStartInstant({ act: input.act }).at.getTime();
    return lastCycleRecordIsOpen({
        complete,
        actStartedAt,
        charges: charges.map((read) => {
            const { snapshot } = assertFreshForAct({ read, act: input.act });
            return {
                createdAt: snapshot.createdAt,
                expiresAt: snapshot.expiresAt,
                status: snapshot.status,
                purpose: snapshot.purpose
            };
        })
    });
}
