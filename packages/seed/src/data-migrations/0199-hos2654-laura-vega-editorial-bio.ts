import { and, eq, sql, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

const oldBio =
    'Moderadora de contenido y community manager. Especializada en gestión de reseñas, resolución de conflictos y mantenimiento de la calidad del contenido en la plataforma.';
const editorialBio =
    'Laura Vega escribe sobre escapadas en Entre Ríos, desde las termas de Federación hasta los deportes acuáticos en los ríos de la provincia.';

/** Metadata for the Laura Vega example bio backfill. */
export const meta = {
    name: '0199-hos2654-laura-vega-editorial-bio',
    group: 'example',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Replace only the original seed bio, preserving any subsequent editorial edits. */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const changed = await db
        .update(users)
        .set({
            profile: sql`jsonb_set(${users.profile}, '{bio}', to_jsonb(${editorialBio}::text))`,
            updatedAt: new Date()
        })
        .where(and(eq(users.slug, 'laura-vega'), sql`${users.profile}->>'bio' = ${oldBio}`))
        .returning({ id: users.id });
    return { summary: 'Replace the Laura Vega example bio.', counts: { updated: changed.length } };
}
