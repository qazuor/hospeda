import { getDb, sql, verticalDeadlineVersions } from '@repo/db';
import type { VerticalDeadlineValues } from '@repo/schemas';
import {
    ChangeVerticalDeadlineSchema,
    PermissionEnum,
    ServiceErrorCode,
    VerticalDeadlineValuesSchema
} from '@repo/schemas';
import { desc, eq } from 'drizzle-orm';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/** The value recorded for any one key of the closed vertical deadline catalog. */
export type VerticalDeadlineValue = VerticalDeadlineValues[keyof VerticalDeadlineValues];

/** A confirmation shown before changing a vertical deadline. */
export interface VerticalDeadlineConfirmation {
    readonly key: number;
    readonly currentVersion: number;
    readonly currentValue: VerticalDeadlineValue;
    readonly newValue: VerticalDeadlineValue;
    readonly message: string;
}

function requireDeadlineManager(actor: Actor): void {
    // MAINTENANCE_MODE_WRITE is granted only to SUPER_ADMIN in the role catalog.
    if (!actor.permissions.includes(PermissionEnum.MAINTENANCE_MODE_WRITE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Sólo SUPER_ADMIN puede cambiar plazos');
    }
}

function withChangedValue(
    values: VerticalDeadlineValues,
    key: number,
    value: unknown
): VerticalDeadlineValues {
    const parsed = VerticalDeadlineValuesSchema.safeParse({ ...values, [String(key)]: value });
    if (!parsed.success) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, parsed.error.message);
    }
    return parsed.data;
}

/** Read the latest published vertical deadlines for a new clock. */
export async function getCurrentVerticalDeadlines(): Promise<
    typeof verticalDeadlineVersions.$inferSelect
> {
    const [row] = await getDb()
        .select()
        .from(verticalDeadlineVersions)
        .orderBy(desc(verticalDeadlineVersions.version))
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Falta la versión 1 de plazos de verticales'
        );
    return row;
}

/** Read the frozen version stored by an already started clock. */
export async function getVerticalDeadlinesVersion(input: {
    version: number;
}): Promise<typeof verticalDeadlineVersions.$inferSelect> {
    const [row] = await getDb()
        .select()
        .from(verticalDeadlineVersions)
        .where(eq(verticalDeadlineVersions.version, input.version))
        .limit(1);
    if (!row) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Versión de plazos inexistente');
    return row;
}

/** Build the required confirmation without mutating a deadline. */
export async function previewVerticalDeadlineChange(input: {
    actor: Actor;
    key: number;
    value: unknown;
}): Promise<VerticalDeadlineConfirmation> {
    requireDeadlineManager(input.actor);
    const parsed = ChangeVerticalDeadlineSchema.omit({
        expectedVersion: true,
        confirmed: true
    }).safeParse({ key: input.key, value: input.value });
    if (!parsed.success)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, parsed.error.message);
    const current = await getCurrentVerticalDeadlines();
    const next = withChangedValue(current.values, parsed.data.key, parsed.data.value);
    const key = String(parsed.data.key) as keyof VerticalDeadlineValues;
    return {
        key: parsed.data.key,
        currentVersion: current.version,
        currentValue: current.values[key],
        newValue: next[key],
        message: `Valor actual: ${JSON.stringify(current.values[key])}; valor nuevo: ${JSON.stringify(next[key])}. Los relojes ya arrancados conservan su versión: las fechas ya anunciadas no se adelantan.`
    };
}

/** Publish one immutable complete snapshot, serialized across concurrent admins. */
export async function changeVerticalDeadline(input: {
    actor: Actor;
    key: number;
    value: unknown;
    expectedVersion: number;
    confirmed: true;
}): Promise<typeof verticalDeadlineVersions.$inferSelect> {
    requireDeadlineManager(input.actor);
    const parsed = ChangeVerticalDeadlineSchema.safeParse({
        key: input.key,
        value: input.value,
        expectedVersion: input.expectedVersion,
        confirmed: input.confirmed
    });
    if (!parsed.success)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, parsed.error.message);
    return getDb().transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(1479, 22)`);
        const [current] = await tx
            .select()
            .from(verticalDeadlineVersions)
            .orderBy(desc(verticalDeadlineVersions.version))
            .limit(1);
        if (!current)
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                'Falta la versión 1 de plazos de verticales'
            );
        if (current.version !== parsed.data.expectedVersion) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'La versión cambió; confirme de nuevo'
            );
        }
        const next = withChangedValue(current.values, parsed.data.key, parsed.data.value);
        const key = String(parsed.data.key) as keyof VerticalDeadlineValues;
        const previousValue = current.values[key];
        if (JSON.stringify(previousValue) === JSON.stringify(next[key])) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'El plazo nuevo debe ser distinto al actual'
            );
        }
        const [published] = await tx
            .insert(verticalDeadlineVersions)
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
