import { billingDeadlineVersions, getDb, sql } from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';
import {
    BillingDeadlineValuesSchema,
    ChangeBillingDeadlineSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { desc, eq } from 'drizzle-orm';
import type { Actor } from '../../../types';
import { ServiceError } from '../../../types';

/** The value recorded for any one key of the closed billing deadline catalog. */
export type BillingDeadlineValue = BillingDeadlineValues[keyof BillingDeadlineValues];

/** A confirmation shown before changing a billing deadline. */
export interface BillingDeadlineConfirmation {
    readonly key: number;
    readonly currentVersion: number;
    readonly currentValue: BillingDeadlineValue;
    readonly newValue: BillingDeadlineValue;
    readonly message: string;
}

function requireDeadlineManager(actor: Actor): void {
    // MAINTENANCE_MODE_WRITE is granted only to SUPER_ADMIN in the role catalog.
    if (!actor.permissions.includes(PermissionEnum.MAINTENANCE_MODE_WRITE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Sólo SUPER_ADMIN puede cambiar plazos');
    }
}

function withChangedValue(
    values: BillingDeadlineValues,
    key: number,
    value: unknown
): BillingDeadlineValues {
    const parsed = BillingDeadlineValuesSchema.safeParse({ ...values, [String(key)]: value });
    if (!parsed.success) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, parsed.error.message);
    }
    return parsed.data;
}

/** Read the latest published billing deadlines for a new clock. */
export async function getCurrentBillingDeadlines(): Promise<
    typeof billingDeadlineVersions.$inferSelect
> {
    const [row] = await getDb()
        .select()
        .from(billingDeadlineVersions)
        .orderBy(desc(billingDeadlineVersions.version))
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Falta la versión 1 de plazos de billing'
        );
    return row;
}

/** Read the frozen version stored by an already started clock. */
export async function getBillingDeadlinesVersion(input: {
    version: number;
}): Promise<typeof billingDeadlineVersions.$inferSelect> {
    const [row] = await getDb()
        .select()
        .from(billingDeadlineVersions)
        .where(eq(billingDeadlineVersions.version, input.version))
        .limit(1);
    if (!row) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Versión de plazos inexistente');
    return row;
}

/** Build the required confirmation without mutating a deadline. */
export async function previewBillingDeadlineChange(input: {
    actor: Actor;
    key: number;
    value: unknown;
}): Promise<BillingDeadlineConfirmation> {
    requireDeadlineManager(input.actor);
    const parsed = ChangeBillingDeadlineSchema.omit({
        expectedVersion: true,
        confirmed: true
    }).safeParse({ key: input.key, value: input.value });
    if (!parsed.success)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, parsed.error.message);
    const current = await getCurrentBillingDeadlines();
    const next = withChangedValue(current.values, parsed.data.key, parsed.data.value);
    const key = String(parsed.data.key) as keyof BillingDeadlineValues;
    return {
        key: parsed.data.key,
        currentVersion: current.version,
        currentValue: current.values[key],
        newValue: next[key],
        message: 'Los relojes ya arrancados conservan su versión y su fecha anunciada.'
    };
}

/** Publish one immutable complete snapshot, serialized across concurrent admins. */
export async function changeBillingDeadline(input: {
    actor: Actor;
    key: number;
    value: unknown;
    expectedVersion: number;
    confirmed: true;
}): Promise<typeof billingDeadlineVersions.$inferSelect> {
    requireDeadlineManager(input.actor);
    const parsed = ChangeBillingDeadlineSchema.safeParse({
        key: input.key,
        value: input.value,
        expectedVersion: input.expectedVersion,
        confirmed: input.confirmed
    });
    if (!parsed.success)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, parsed.error.message);
    return getDb().transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(1516, 22)`);
        const [current] = await tx
            .select()
            .from(billingDeadlineVersions)
            .orderBy(desc(billingDeadlineVersions.version))
            .limit(1);
        if (!current)
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                'Falta la versión 1 de plazos de billing'
            );
        if (current.version !== parsed.data.expectedVersion) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'La versión cambió; confirme de nuevo'
            );
        }
        const next = withChangedValue(current.values, parsed.data.key, parsed.data.value);
        const key = String(parsed.data.key) as keyof BillingDeadlineValues;
        const previousValue = current.values[key];
        if (JSON.stringify(previousValue) === JSON.stringify(next[key])) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'El plazo nuevo debe ser distinto al actual'
            );
        }
        const [published] = await tx
            .insert(billingDeadlineVersions)
            .values({
                version: current.version + 1,
                values: next,
                changedKey: parsed.data.key,
                previousValue,
                newValue: next[key],
                changedBy: input.actor.id
            })
            .returning();
        if (!published)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'No se publicó la versión de plazos'
            );
        return published;
    });
}
