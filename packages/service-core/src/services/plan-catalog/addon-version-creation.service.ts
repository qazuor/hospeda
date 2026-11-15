import type { DrizzleClient, SelectAddon, SelectAddonVersion } from '@repo/db';
import {
    addons,
    addonVersionEntitlements,
    addonVersionLimits,
    addonVersions,
    catalogKeys,
    eq,
    getDb,
    inArray
} from '@repo/db';
import type { CreateAddonRequest, CreateAddonVersionRequest } from '@repo/schemas';
import {
    CreateAddonRequestSchema,
    CreateAddonVersionRequestSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { isAdministrativeActionPermitted } from '@repo/verticals';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { extractPostgresErrorCause } from '../../utils/postgres-error-cause.js';
import { isSystemActor } from '../../utils/system-actor.js';

function reject(reason: string, code = ServiceErrorCode.VALIDATION_ERROR): never {
    throw new ServiceError(code, reason, undefined, reason);
}

function assertCreator(actor?: Actor): void {
    if (
        !actor ||
        isSystemActor(actor) ||
        !isAdministrativeActionPermitted({
            action: 'ACC_20',
            actorPermissions: actor.permissions
        })
    )
        reject('ADMINISTRATIVE_ACTION_FORBIDDEN', ServiceErrorCode.FORBIDDEN);
}

async function insertVersion(args: {
    readonly tx: DrizzleClient;
    readonly addonId: string;
    readonly content: Omit<CreateAddonVersionRequest, 'addonId'>;
}): Promise<SelectAddonVersion> {
    const { tx, addonId, content } = args;
    const keys = [
        ...content.entitlements.map((key) => ({ key, kind: 'entitlement' })),
        ...content.limits.map(({ key }) => ({ key, kind: 'limit' }))
    ];
    const unique = [...new Set(keys.map(({ key }) => key))];
    if (unique.length !== keys.length) reject('ADDON_VERSION_DUPLICATE_KEY');
    if (unique.length > 0) {
        const rows = await tx
            .select({ key: catalogKeys.key, kind: catalogKeys.kind })
            .from(catalogKeys)
            .where(inArray(catalogKeys.key, unique));
        const known = new Map(rows.map((row) => [row.key, row.kind]));
        for (const { key, kind } of keys) {
            if (known.get(key) !== kind) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid catalog key: ${key}`,
                    undefined,
                    'ADDON_CATALOG_KEY_INVALID'
                );
            }
        }
    }
    const [version] = await tx
        .insert(addonVersions)
        .values({
            addonId,
            validity: content.validity,
            validityDays: content.validityDays,
            scopeType: content.scopeType
        })
        .returning();
    if (!version) reject('ADDON_VERSION_NOT_CREATED', ServiceErrorCode.INTERNAL_ERROR);
    if (content.entitlements.length > 0) {
        await tx
            .insert(addonVersionEntitlements)
            .values(content.entitlements.map((key) => ({ addonVersionId: version.id, key })));
    }
    if (content.limits.length > 0) {
        await tx
            .insert(addonVersionLimits)
            .values(
                content.limits.map(({ key, value }) => ({ addonVersionId: version.id, key, value }))
            );
    }
    return version;
}

/** Create an addon and its first immutable version in one transaction. */
export async function createAddon(args: {
    readonly actor?: Actor;
    readonly input: unknown;
}): Promise<{ readonly addon: SelectAddon; readonly version: SelectAddonVersion }> {
    assertCreator(args.actor);
    const parsed = CreateAddonRequestSchema.safeParse(args.input);
    if (!parsed.success) reject('INVALID_ADDON_CREATION_INPUT');
    const input: CreateAddonRequest = parsed.data;
    try {
        return await getDb().transaction(async (tx) => {
            const [addon] = await tx
                .insert(addons)
                .values({ slug: input.slug, name: input.name, description: input.description })
                .returning();
            if (!addon) reject('ADDON_NOT_CREATED', ServiceErrorCode.INTERNAL_ERROR);
            const version = await insertVersion({
                tx,
                addonId: addon.id,
                content: input.firstVersion
            });
            return { addon, version };
        });
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === 'uq_addon_slug') {
            reject('ADDON_ALREADY_EXISTS', ServiceErrorCode.ALREADY_EXISTS);
        }
        throw error;
    }
}

/** Append an immutable version; purchased instances keep their original version. */
export async function createAddonVersion(args: {
    readonly actor?: Actor;
    readonly input: unknown;
}): Promise<SelectAddonVersion> {
    assertCreator(args.actor);
    const parsed = CreateAddonVersionRequestSchema.safeParse(args.input);
    if (!parsed.success) reject('INVALID_ADDON_VERSION_CREATION_INPUT');
    const input: CreateAddonVersionRequest = parsed.data;
    return getDb().transaction(async (tx) => {
        const [addon] = await tx
            .select({ id: addons.id })
            .from(addons)
            .where(eq(addons.id, input.addonId))
            .limit(1);
        if (!addon) reject('ADDON_NOT_FOUND', ServiceErrorCode.NOT_FOUND);
        return insertVersion({ tx, addonId: input.addonId, content: input });
    });
}
