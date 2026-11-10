import type { DrizzleClient } from '@repo/db';
import { and, eq, inArray, planMigrationSubscriptions } from '@repo/db';
import { z } from 'zod';

const inputSchema = z.strictObject({
    tx: z.custom<DrizzleClient>(
        (value) => typeof value === 'object' && value !== null && 'update' in value
    ),
    subscriptionId: z.uuid(),
    reason: z.enum(['SE_DIO_DE_BAJA', 'CAMBIO_DE_PLAN'])
});

/** Exit live migration scope rows within the transaction accepting a customer act. */
export async function exitPlanMigration(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly reason: 'SE_DIO_DE_BAJA' | 'CAMBIO_DE_PLAN';
}): Promise<{ exited: number }> {
    const { tx, subscriptionId, reason } = inputSchema.parse(input);
    const rows = await tx
        .update(planMigrationSubscriptions)
        .set({ status: 'FUERA', outReason: reason })
        .where(
            and(
                eq(planMigrationSubscriptions.subscriptionId, subscriptionId),
                inArray(planMigrationSubscriptions.status, ['PENDIENTE', 'PARA_RESOLVER'])
            )
        )
        .returning({ id: planMigrationSubscriptions.id });
    return { exited: rows.length };
}
