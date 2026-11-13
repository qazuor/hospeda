import type { Venue } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModelImpl } from '../../src/base/base.model';
import * as dbUtils from '../../src/client';
import { ExperienceModel } from '../../src/models/experience/experience.model';
import { VenueModel } from '../../src/models/venue/venue.model';
import { venues } from '../../src/schemas/venue/venue.dbschema';

class DefaultFeaturedModel extends BaseModelImpl<Venue> {
    protected table = venues;
    public entityName = 'venues';

    protected getTableName(): string {
        return 'venues';
    }
}

const dialect = new PgDialect();

describe('HOS-1718 featuredFirst pins featured listings first on venue and experience', () => {
    let getDb: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        getDb = vi.spyOn(dbUtils, 'getDb');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function captureOrderBy(
        model: VenueModel | ExperienceModel | DefaultFeaturedModel,
        options: { featuredFirst?: boolean; sortBy?: string; sortOrder?: 'asc' | 'desc' }
    ): Promise<SQL | SQL[] | undefined> {
        let orderBy: SQL | SQL[] | undefined;
        const findMany = vi.fn(async (queryOptions: { orderBy?: SQL | SQL[] }) => {
            orderBy = queryOptions.orderBy;
            return [];
        });
        getDb.mockReturnValue({ query: { [model.entityName]: { findMany } } });
        vi.spyOn(model, 'count').mockResolvedValue(0);

        await model.findAllWithRelations({ destination: true }, {}, options);
        return orderBy;
    }

    function renderOrderBy(orderBy: SQL | SQL[] | undefined): string[] {
        if (!orderBy) return [];
        return (Array.isArray(orderBy) ? orderBy : [orderBy]).map(
            (clause) => dialect.sqlToQuery(clause).sql
        );
    }

    it('VenueModel prepends featured_by_entitlement desc', async () => {
        const orderBy = await captureOrderBy(new VenueModel(), {
            featuredFirst: true,
            sortBy: 'name',
            sortOrder: 'asc'
        });

        expect(renderOrderBy(orderBy)).toEqual([
            '"venues"."featured_by_entitlement" desc',
            '"venues"."name" asc'
        ]);
    });

    it('ExperienceModel prepends it too', async () => {
        const orderBy = await captureOrderBy(new ExperienceModel(), {
            featuredFirst: true,
            sortBy: 'name',
            sortOrder: 'asc'
        });

        expect(renderOrderBy(orderBy)).toEqual([
            '"experiences"."featured_by_entitlement" desc',
            '"experiences"."name" asc'
        ]);
    });

    it('without featuredFirst the order is unchanged', async () => {
        const orderBy = await captureOrderBy(new VenueModel(), {
            sortBy: 'name',
            sortOrder: 'asc'
        });

        expect(renderOrderBy(orderBy)).toEqual(['"venues"."name" asc']);
    });

    it('a model that does not opt in ignores featuredFirst', async () => {
        const orderBy = await captureOrderBy(new DefaultFeaturedModel(), { featuredFirst: true });

        expect(orderBy).toBeUndefined();
    });
});
