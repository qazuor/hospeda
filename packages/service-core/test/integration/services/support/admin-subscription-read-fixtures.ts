import { eq, subscriptions, users } from '@repo/db';
import { getServiceTestDb } from '../helpers.js';
import { providerHarness } from './complement-fixtures.js';
import { retirePauseRows, seedPausePrincipal } from './pause-fixtures.js';

/** Seed a principal through the existing fixture, assigning a unique searchable owner. */
export async function seedAdminSubscriptionReadPrincipal(input: {
    readonly token: string;
    readonly label: string;
}) {
    const harness = providerHarness();
    const principal = await seedPausePrincipal({ harness });
    const email = `${input.token}-${input.label}@example.test`;
    const displayName = `${input.token} ${input.label}`;
    // Fixture seeding: seedCoverageUser does not accept a chosen email or display name.
    await getServiceTestDb()
        .update(users)
        .set({ email, displayName })
        .where(eq(users.id, principal.userId));
    return { ...principal, email, displayName, harness };
}

/** Seed a tombstone to verify the list excludes this internal row class. */
export async function seedAdminSubscriptionReadTombstone(): Promise<string> {
    const principal = await seedAdminSubscriptionReadPrincipal({
        token: crypto.randomUUID(),
        label: 'tombstone'
    });
    // Fixture seeding: retain the real provider link required by the tombstone constraint.
    await getServiceTestDb()
        .update(subscriptions)
        .set({ class: 'LAPIDA', status: 'CANCELLED' })
        .where(eq(subscriptions.id, principal.subscriptionId));
    return principal.subscriptionId;
}

/** Retire only rows created by these fixtures and their tracked principal fixture. */
export async function retireAdminSubscriptionReadFixtures(): Promise<void> {
    await retirePauseRows();
}
