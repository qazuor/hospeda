import type { SponsorshipLevel } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model.ts';
import { getDb } from '../../client.ts';
import { sponsorshipLevels } from '../../schemas/sponsorship/sponsorship_level.dbschema.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for managing sponsorship levels in the database.
 * Extends BaseModel to provide CRUD operations for sponsorship level entities.
 */
export class SponsorshipLevelModel extends BaseModel<SponsorshipLevel> {
    protected table = sponsorshipLevels;
    protected entityName = 'sponsorshipLevels';

    protected getTableName(): string {
        return 'sponsorshipLevels';
    }

    /**
     * Finds a sponsorship level by its unique slug.
     * @param slug - The slug to search for
     * @returns Promise resolving to the sponsorship level or null if not found
     */
    async findBySlug(slug: string): Promise<SponsorshipLevel | null> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(sponsorshipLevels)
                .where(eq(sponsorshipLevels.slug, slug))
                .limit(1);

            logQuery(this.entityName, 'findBySlug', { slug }, result);
            return (result[0] as unknown as SponsorshipLevel) ?? null;
        } catch (error) {
            logError(this.entityName, 'findBySlug', { slug }, error as Error);
            throw new DbError(this.entityName, 'findBySlug', { slug }, (error as Error).message);
        }
    }

    /**
     * Finds active sponsorship levels by target type.
     * @param targetType - The target type to filter by
     * @returns Promise resolving to an array of active sponsorship levels
     */
    async findActiveByTargetType(
        targetType: string
    ): Promise<{ items: SponsorshipLevel[]; total: number }> {
        try {
            const result = await this.findAll({
                targetType,
                isActive: true,
                deletedAt: null
            });

            logQuery(this.entityName, 'findActiveByTargetType', { targetType }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findActiveByTargetType', { targetType }, error as Error);
            throw new DbError(
                this.entityName,
                'findActiveByTargetType',
                { targetType },
                (error as Error).message
            );
        }
    }

    /**
     * Finds a sponsorship level with its creator, updater, and deleter relations populated.
     * @param where - The filter object
     * @param relations - The relations to include
     * @returns Promise resolving to the sponsorship level with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<SponsorshipLevel | null> {
        const db = getDb();
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of ['createdBy', 'updatedBy', 'deletedBy']) {
                if (relations[key]) withObj[key] = true;
            }

            if (Object.keys(withObj).length > 0) {
                const result = await db.query.sponsorshipLevels.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });

                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as unknown as SponsorshipLevel | null;
            }

            const result = await this.findOne(where);
            logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findWithRelations', { where, relations }, error as Error);
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where, relations },
                (error as Error).message
            );
        }
    }
}
