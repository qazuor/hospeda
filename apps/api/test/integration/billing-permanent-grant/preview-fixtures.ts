import { courtesyGrants, getDb, inArray } from '@repo/db';

const courtesyIds: string[] = [];

/** Seed only the deferred courtesy explicitly allowed by TEST:B13a:5. */
export async function seedRouteDeferredCourtesy(input: {
    readonly beneficiaryUserId: string;
    readonly grantedBy: string;
    readonly subscriptionId: string;
    readonly balanceMonths: number;
}): Promise<string> {
    const now = new Date('2026-10-05T12:00:00.000Z');
    const [row] = await getDb()
        .insert(courtesyGrants)
        .values({
            beneficiaryUserId: input.beneficiaryUserId,
            grantedBy: input.grantedBy,
            subscriptionId: input.subscriptionId,
            months: input.balanceMonths,
            startsAt: new Date(now.getTime() - 86_400_000),
            endsAt: new Date(now.getTime() + 86_400_000),
            reason: 'Deferred balance for permanent grant preview',
            balanceMonths: input.balanceMonths
        })
        .returning({ id: courtesyGrants.id });
    if (!row) throw new Error('Expected deferred courtesy');
    courtesyIds.push(row.id);
    return row.id;
}

/** Retire only courtesy rows owned by this test fixture. */
export async function retireRoutePreviewCourtesies(): Promise<void> {
    const ids = courtesyIds.splice(0);
    if (ids.length) await getDb().delete(courtesyGrants).where(inArray(courtesyGrants.id, ids));
}
