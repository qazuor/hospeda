import type { Sponsorship } from '@repo/schemas';
import { and, eq, gte, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { sponsorships } from '../../schemas/sponsorship/sponsorship.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * Model for managing sponsorships in the database.
 * Extends BaseModel to provide CRUD operations for sponsorship entities.
 */
export class SponsorshipModel extends BaseModelImpl<Sponsorship> {
    protected table = sponsorships;
    public entityName = 'sponsorships';

    protected override readonly validRelationKeys = [
        'sponsorUser',
        'level',
        'package',
        'createdBy',
        'updatedBy',
        'deletedBy'
    ] as const;

    protected getTableName(): string {
        return 'sponsorships';
    }

    /**
     * Finds a sponsorship by its unique slug.
     * @param slug - The slug to search for
     * @param tx - Optional transaction client
     * @returns Promise resolving to the sponsorship or null if not found
     */
    async findBySlug(slug: string, tx?: DrizzleClient): Promise<Sponsorship | null> {
        const db = this.getClient(tx);
        try {
            const result = await db
                .select()
                .from(sponsorships)
                .where(eq(sponsorships.slug, slug))
                .limit(1);

            logQuery(this.entityName, 'findBySlug', { slug }, result);
            return (result[0] as Sponsorship) ?? null;
        } catch (error) {
            logError(this.entityName, 'findBySlug', { slug }, error as Error);
            throw new DbError(this.entityName, 'findBySlug', { slug }, (error as Error).message);
        }
    }

    /**
     * Finds sponsorships by sponsor user ID.
     * @param sponsorUserId - The sponsor user ID to filter by
     * @param tx - Optional transaction client
     * @returns Promise resolving to an object with items and total count
     */
    async findBySponsorUserId(
        sponsorUserId: string,
        tx?: DrizzleClient
    ): Promise<{ items: Sponsorship[]; total: number }> {
        try {
            const result = await this.findAll(
                { sponsorUserId, deletedAt: null },
                undefined,
                undefined,
                tx
            );

            logQuery(this.entityName, 'findBySponsorUserId', { sponsorUserId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findBySponsorUserId', { sponsorUserId }, error as Error);
            throw new DbError(
                this.entityName,
                'findBySponsorUserId',
                { sponsorUserId },
                (error as Error).message
            );
        }
    }

    /**
     * Finds active sponsorships by target type and target ID.
     * @param targetType - The target type
     * @param targetId - The target ID
     * @param tx - Optional transaction client
     * @returns Promise resolving to an object with items and total count
     */
    async findActiveByTarget(
        targetType: string,
        targetId: string,
        tx?: DrizzleClient
    ): Promise<{ items: Sponsorship[]; total: number }> {
        const db = this.getClient(tx);
        try {
            const now = new Date();
            const result = await db
                .select()
                .from(sponsorships)
                .where(
                    and(
                        eq(sponsorships.targetType, targetType),
                        eq(sponsorships.targetId, targetId),
                        eq(sponsorships.status, 'active'),
                        lte(sponsorships.startsAt, now),
                        gte(sponsorships.endsAt, now)
                    )
                );

            const total = result.length;
            logQuery(this.entityName, 'findActiveByTarget', { targetType, targetId }, result);
            return { items: result as Sponsorship[], total };
        } catch (error) {
            logError(
                this.entityName,
                'findActiveByTarget',
                { targetType, targetId },
                error as Error
            );
            throw new DbError(
                this.entityName,
                'findActiveByTarget',
                { targetType, targetId },
                (error as Error).message
            );
        }
    }

    /**
     * Finds sponsorships by status.
     * @param status - The status to filter by
     * @param tx - Optional transaction client
     * @returns Promise resolving to an object with items and total count
     */
    async findByStatus(
        status: string,
        tx?: DrizzleClient
    ): Promise<{ items: Sponsorship[]; total: number }> {
        try {
            const result = await this.findAll(
                { status, deletedAt: null },
                undefined,
                undefined,
                tx
            );

            logQuery(this.entityName, 'findByStatus', { status }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findByStatus', { status }, error as Error);
            throw new DbError(
                this.entityName,
                'findByStatus',
                { status },
                (error as Error).message
            );
        }
    }

    /**
     * Finds a sponsorship with its related entities populated.
     * @param where - The filter object
     * @param relations - The relations to include
     * @param tx - Optional transaction client
     * @returns Promise resolving to the sponsorship with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<Sponsorship | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, boolean | Record<string, unknown>> = {};
            for (const key of [
                'sponsorUser',
                'level',
                'package',
                'createdBy',
                'updatedBy',
                'deletedBy'
            ]) {
                if (relations[key]) withObj[key] = relations[key];
            }

            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.sponsorships.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });

                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as Sponsorship | null;
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

/** Singleton instance of SponsorshipModel for use across the application. */
export const sponsorshipModel = new SponsorshipModel();
