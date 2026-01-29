import type { SponsorshipPackage } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { sponsorshipPackages } from '../../schemas/sponsorship/sponsorship_package.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

/**
 * Model for managing sponsorship packages in the database.
 * Extends BaseModel to provide CRUD operations for sponsorship package entities.
 */
export class SponsorshipPackageModel extends BaseModel<SponsorshipPackage> {
    protected table = sponsorshipPackages;
    protected entityName = 'sponsorshipPackages';

    protected getTableName(): string {
        return 'sponsorshipPackages';
    }

    /**
     * Finds a sponsorship package by its unique slug.
     * @param slug - The slug to search for
     * @returns Promise resolving to the sponsorship package or null if not found
     */
    async findBySlug(slug: string): Promise<SponsorshipPackage | null> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(sponsorshipPackages)
                .where(eq(sponsorshipPackages.slug, slug))
                .limit(1);

            logQuery(this.entityName, 'findBySlug', { slug }, result);
            return (result[0] as SponsorshipPackage) ?? null;
        } catch (error) {
            logError(this.entityName, 'findBySlug', { slug }, error as Error);
            throw new DbError(this.entityName, 'findBySlug', { slug }, (error as Error).message);
        }
    }

    /**
     * Finds all active sponsorship packages.
     * @returns Promise resolving to an object with items and total count
     */
    async findActive(): Promise<{ items: SponsorshipPackage[]; total: number }> {
        try {
            const result = await this.findAll({
                isActive: true,
                deletedAt: null
            });

            logQuery(this.entityName, 'findActive', {}, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findActive', {}, error as Error);
            throw new DbError(this.entityName, 'findActive', {}, (error as Error).message);
        }
    }

    /**
     * Finds a sponsorship package with its related entities populated.
     * @param where - The filter object
     * @param relations - The relations to include
     * @returns Promise resolving to the sponsorship package with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<SponsorshipPackage | null> {
        const db = getDb();
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of ['eventLevel', 'createdBy', 'updatedBy', 'deletedBy']) {
                if (relations[key]) withObj[key] = true;
            }

            if (Object.keys(withObj).length > 0) {
                const result = await db.query.sponsorshipPackages.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });

                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as SponsorshipPackage | null;
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
