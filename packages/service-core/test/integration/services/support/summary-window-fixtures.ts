import {
    billingDeadlineVersions,
    type DrizzleClient,
    desc,
    reconciliationSummaryWindowModel
} from '@repo/db';

export async function seedClosedWindowBefore(
    tx: DrizzleClient,
    boundary: Date,
    leadMilliseconds = 1_000
) {
    const [deadline] = await tx
        .select()
        .from(billingDeadlineVersions)
        .orderBy(desc(billingDeadlineVersions.version))
        .limit(1);
    if (!deadline) throw new Error('Current deadline version missing');
    const closesAt = new Date(boundary.getTime() - leadMilliseconds);
    const previous = await reconciliationSummaryWindowModel.open({
        coversFrom: new Date(closesAt.getTime() - 60 * 60_000),
        openedAt: new Date(closesAt.getTime() - 60 * 60_000),
        closesAt,
        windowMinutes: 60,
        deadlinesVersion: deadline.version,
        tx
    });
    if (!previous) throw new Error('Expected to open preceding summary window');
    await reconciliationSummaryWindowModel.markSent({
        id: previous.id,
        sentAt: closesAt,
        eventCount: 0,
        tx
    });
}

export async function publishDeadline(
    tx: DrizzleClient,
    version: number,
    minutes: number,
    previousValue: unknown
) {
    const values = {
        ...(previousValue && typeof previousValue === 'object' ? previousValue : {}),
        '19': { minutes }
    };
    await tx.insert(billingDeadlineVersions).values({
        version,
        values: values as never,
        changedKey: 19,
        previousValue: previousValue as never,
        newValue: values['19']
    });
}
