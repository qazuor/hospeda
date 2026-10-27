/**
 * @fileoverview
 * Rename persisted What's New seen ids and the venue welcome tour key after
 * the venue catalog and tour ids changed in HOS-1822.
 */
import { eq, sql, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0131-hos1822-venue-whats-new-and-tour-ids',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

export const WHATS_NEW_ID_RENAMES: Readonly<Record<string, string>> = {
    '2026-09-05-gastronomy-experience-publish-free-trial':
        '2026-09-05-venue-experience-publish-free-trial',
    '2026-09-03-ai-chat-gastronomy-experience': '2026-09-03-ai-chat-venue-experience',
    '2026-09-03-gastronomy-daily-menu': '2026-09-03-venue-daily-menu'
};

const SEEN_IDS_PATH = '{onboarding,whatsNew,seenIds}';
const ADMIN_TOURS_PATH = '{onboarding,adminTours}';
const OLD_TOUR_ID = 'web.gastronomy.welcome';
const NEW_TOUR_ID = 'web.venue.welcome';

export function renameSeenIds({ seenIds }: { readonly seenIds: readonly string[] }): {
    readonly seenIds: readonly string[];
    readonly changed: boolean;
} {
    const result: string[] = [];
    for (const id of seenIds) {
        const next = WHATS_NEW_ID_RENAMES[id] ?? id;
        if (!result.includes(next)) result.push(next);
    }
    return {
        seenIds: result,
        changed:
            result.length !== seenIds.length || result.some((id, index) => id !== seenIds[index])
    };
}

export function renameAdminTours({
    adminTours
}: {
    readonly adminTours: Readonly<Record<string, number>>;
}): {
    readonly adminTours: Readonly<Record<string, number>>;
    readonly changed: boolean;
} {
    if (!(OLD_TOUR_ID in adminTours)) return { adminTours, changed: false };
    const { [OLD_TOUR_ID]: oldVersion, ...rest } = adminTours;
    const nextVersion =
        NEW_TOUR_ID in rest ? Math.max(rest[NEW_TOUR_ID] ?? 0, oldVersion ?? 0) : oldVersion;
    return { adminTours: { ...rest, [NEW_TOUR_ID]: nextVersion }, changed: true };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const holdsOldSeenId = sql.join(
        Object.keys(WHATS_NEW_ID_RENAMES).map(
            (oldId) => sql`(${users.settings} #> ${SEEN_IDS_PATH}::text[]) ? ${oldId}`
        ),
        sql` OR `
    );
    const rows = await ctx.db
        .select({
            id: users.id,
            seenIds: sql<unknown>`${users.settings} #> ${SEEN_IDS_PATH}::text[]`,
            adminTours: sql<unknown>`${users.settings} #> ${ADMIN_TOURS_PATH}::text[]`
        })
        .from(users)
        .where(
            sql`(${holdsOldSeenId}) OR (${users.settings} #> ${ADMIN_TOURS_PATH}::text[]) ? ${OLD_TOUR_ID}`
        );

    let usersRewritten = 0;
    for (const row of rows) {
        const currentSeenIds = row.seenIds;
        const currentAdminTours = row.adminTours;
        if (
            currentSeenIds !== null &&
            currentSeenIds !== undefined &&
            (!Array.isArray(currentSeenIds) || currentSeenIds.some((id) => typeof id !== 'string'))
        ) {
            throw new Error(
                `User ${row.id} matched an old What's New id but its seenIds is not an array of strings.`
            );
        }
        if (
            currentAdminTours !== null &&
            currentAdminTours !== undefined &&
            (typeof currentAdminTours !== 'object' ||
                Array.isArray(currentAdminTours) ||
                Object.values(currentAdminTours).some((version) => typeof version !== 'number'))
        ) {
            throw new Error(
                `User ${row.id} matched an old tour id but its adminTours is not a version map.`
            );
        }
        const seenIds = Array.isArray(currentSeenIds)
            ? renameSeenIds({ seenIds: currentSeenIds as string[] })
            : null;
        const tours =
            currentAdminTours && typeof currentAdminTours === 'object'
                ? renameAdminTours({ adminTours: currentAdminTours as Record<string, number> })
                : null;
        if (!seenIds?.changed && !tours?.changed) continue;

        let settings = sql`${users.settings}`;
        if (seenIds?.changed) {
            settings = sql`jsonb_set(${settings}, ${SEEN_IDS_PATH}::text[], ${JSON.stringify(seenIds.seenIds)}::jsonb)`;
        }
        if (tours?.changed) {
            settings = sql`jsonb_set(${settings}, ${ADMIN_TOURS_PATH}::text[], ${JSON.stringify(tours.adminTours)}::jsonb)`;
        }
        await ctx.db.update(users).set({ settings }).where(eq(users.id, row.id));
        usersRewritten += 1;
    }

    return {
        summary:
            usersRewritten === 0
                ? "No persisted What's New or tour ids needed renaming."
                : `Renamed persisted What's New and tour ids for ${usersRewritten} user(s).`,
        counts: { usersRewritten }
    };
}
