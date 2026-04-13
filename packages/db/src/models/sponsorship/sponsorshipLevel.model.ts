import type { SponsorshipLevel } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { sponsorshipLevels } from '../../schemas/sponsorship/sponsorship_level.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * Model for managing sponsorship levels in the database.
 * Extends BaseModel to provide CRUD operations for sponsorship level entities.
 */
export class SponsorshipLevelModel extends BaseModelImpl<SponsorshipLevel> {
    protected table = sponsorshipLevels;
    public entityName = 'sponsorshipLevels';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy'
    ] as const;

    protected getTableName(): string {
        return 'sponsorshipLevels';
    }

    /**
     * Finds a sponsorship level by its unique slug.
     * @param slug - The slug to search for
     * @param tx - Optional transaction client
     * @returns Promise resolving to the sponsorship level or null if not found
     */
    async findBySlug(slug: string, tx?: DrizzleClient): Promise<SponsorshipLevel | null> {
        const db = this.getClient(tx);
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
     * @param tx - Optional transaction client
     * @returns Promise resolving to an array of active sponsorship levels
     */
    async findActiveByTargetType(
        targetType: string,
        tx?: DrizzleClient
    ): Promise<{ items: SponsorshipLevel[]; total: number }> {
        try {
            const result = await this.findAll(
                { targetType, isActive: true, deletedAt: null },
                undefined,
                undefined,
                tx
            );

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
     * @param tx - Optional transaction client
     * @returns Promise resolving to the sponsorship level with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<SponsorshipLevel | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of ['createdBy', 'updatedBy', 'deletedBy']) {
                if (relations[key]) withObj[key] = true;
            }

            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.sponsorshipLevels.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });

                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as unknown as SponsorshipLevel | null;
            }

            const result = await this.findOne(where, tx);
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

/** Singleton instance of SponsorshipLevelModel for use across the application. */
export const sponsorshipLevelModel = new SponsorshipLevelModel();
