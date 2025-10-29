import type { ClientAccessRight } from '@repo/schemas';
import { AccessRightScopeEnum } from '@repo/schemas';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { clientAccessRights } from '../../schemas/client/clientAccessRight.dbschema';
import type * as schema from '../../schemas/index.js';

export class ClientAccessRightModel extends BaseModel<ClientAccessRight> {
    protected table = clientAccessRights;
    protected entityName = 'clientAccessRight';

    protected getTableName(): string {
        return 'client_access_rights';
    }

    /**
     * Find access rights by scope
     */
    async findByScope(
        scope: AccessRightScopeEnum,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<ClientAccessRight[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(eq(clientAccessRights.scope, scope));

        return result as ClientAccessRight[];
    }

    /**
     * Find access rights by scope type
     */
    async findByScopeType(
        scopeType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<ClientAccessRight[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(eq(clientAccessRights.scopeType, scopeType));

        return result as ClientAccessRight[];
    }

    /**
     * Find currently active access rights
     */
    async findActiveRights(tx?: NodePgDatabase<typeof schema>): Promise<ClientAccessRight[]> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .select()
            .from(this.table)
            .where(
                and(
                    lte(clientAccessRights.validFrom, now),
                    // Either no expiration or not yet expired
                    sql`(${clientAccessRights.validTo} IS NULL OR ${clientAccessRights.validTo} > ${now})`
                )
            );

        return result as ClientAccessRight[];
    }

    /**
     * Check if client has specific permission
     */
    async hasPermission(
        clientId: string,
        feature: string,
        scope: AccessRightScopeEnum,
        scopeId?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        const db = this.getClient(tx);
        const now = new Date();

        let whereClause = and(
            eq(clientAccessRights.clientId, clientId),
            eq(clientAccessRights.feature, feature),
            eq(clientAccessRights.scope, scope),
            lte(clientAccessRights.validFrom, now),
            sql`(${clientAccessRights.validTo} IS NULL OR ${clientAccessRights.validTo} > ${now})`
        );

        // Add scope-specific filtering if needed
        if (scope !== AccessRightScopeEnum.GLOBAL && scopeId) {
            whereClause = and(whereClause, eq(clientAccessRights.scopeId, scopeId));
        }

        const result = await db.select().from(this.table).where(whereClause);

        return result.length > 0;
    }

    /**
     * Find access rights by subscription item
     */
    async findBySubscriptionItem(
        subscriptionItemId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<ClientAccessRight[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(eq(clientAccessRights.subscriptionItemId, subscriptionItemId));

        return result as ClientAccessRight[];
    }

    /**
     * Find access rights expiring within specified days
     */
    async findExpiring(
        days: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<ClientAccessRight[]> {
        const db = this.getClient(tx);
        const now = new Date();
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        const result = await db
            .select()
            .from(this.table)
            .where(
                and(
                    gte(clientAccessRights.validTo, now),
                    lte(clientAccessRights.validTo, futureDate)
                )
            );

        return result as ClientAccessRight[];
    }

    /**
     * Get active features for a client
     */
    async getActiveFeatures(
        clientId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<string[]> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .select({ feature: clientAccessRights.feature })
            .from(this.table)
            .where(
                and(
                    eq(clientAccessRights.clientId, clientId),
                    lte(clientAccessRights.validFrom, now),
                    sql`(${clientAccessRights.validTo} IS NULL OR ${clientAccessRights.validTo} > ${now})`
                )
            );

        return result.map((row) => row.feature);
    }

    /**
     * Grant access right to a client
     */
    async grantAccess(
        clientId: string,
        subscriptionItemId: string,
        feature: string,
        scope: AccessRightScopeEnum,
        validFrom: Date,
        validTo?: Date,
        scopeId?: string,
        scopeType?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<ClientAccessRight> {
        const db = this.getClient(tx);

        const newAccessRight = {
            clientId,
            subscriptionItemId,
            feature,
            scope,
            scopeId: scopeId || null,
            scopeType: scopeType || null,
            validFrom,
            validTo: validTo || null
        };

        const result = await db.insert(this.table).values(newAccessRight).returning();

        return result[0] as ClientAccessRight;
    }

    /**
     * Revoke access right for a client
     */
    async revokeAccess(
        clientId: string,
        feature: string,
        scope: AccessRightScopeEnum,
        scopeId?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        const db = this.getClient(tx);
        const now = new Date();

        let whereClause = and(
            eq(clientAccessRights.clientId, clientId),
            eq(clientAccessRights.feature, feature),
            eq(clientAccessRights.scope, scope)
        );

        if (scope !== AccessRightScopeEnum.GLOBAL && scopeId) {
            whereClause = and(whereClause, eq(clientAccessRights.scopeId, scopeId));
        }

        const result = await db.update(this.table).set({ validTo: now }).where(whereClause);

        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Find conflicts in access rights
     */
    async findConflicts(
        clientId: string,
        feature: string,
        scope: AccessRightScopeEnum,
        scopeId?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<ClientAccessRight[]> {
        const db = this.getClient(tx);
        const now = new Date();

        let whereClause = and(
            eq(clientAccessRights.clientId, clientId),
            eq(clientAccessRights.feature, feature),
            eq(clientAccessRights.scope, scope),
            lte(clientAccessRights.validFrom, now),
            sql`(${clientAccessRights.validTo} IS NULL OR ${clientAccessRights.validTo} > ${now})`
        );

        if (scope !== AccessRightScopeEnum.GLOBAL && scopeId) {
            whereClause = and(whereClause, eq(clientAccessRights.scopeId, scopeId));
        }

        const result = await db.select().from(this.table).where(whereClause);

        return result as ClientAccessRight[];
    }
}
