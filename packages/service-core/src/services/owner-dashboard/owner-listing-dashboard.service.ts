/**
 * Aggregate dashboard of a venue or experience owner (HOS-2475, HOS-2476).
 *
 * One call returns what the owner dashboard needs: the owner's listings
 * counted by publication state, and, when the plan allows it, the traffic
 * total of those listings over a rolling window. The response contract is
 * `OwnerListingDashboardSchema` in `@repo/schemas`.
 *
 * ## Deliberately NOT a `BaseCrudService`
 *
 * There is no CRUD surface: this is one read aggregate that composes COUNT
 * queries on the vertical's model and `EntityViewService.getStatsForOwnListings`.
 *
 * ## Ownership is structural
 *
 * No listing or owner id is accepted. The counts are filtered by
 * `ownerId = actor.id` and the view read receives only the caller's actor, so
 * another owner's listings can never be counted.
 *
 * ## Permission
 *
 * The caller must hold `VENUE_EDIT_OWN` / `EXPERIENCE_EDIT_OWN` for the
 * vertical; otherwise the answer is `FORBIDDEN` (403) and nothing is read.
 *
 * ## Failure semantics
 *
 * - A failed listings read is a service error. The counts are never degraded
 *   to zeros, because a zero would read as "you have no listings".
 * - A locked plan or a failed traffic read yields no `traffic` key at all
 *   (`trafficAccess: 'locked' | 'unavailable'`), never a fabricated `0`.
 * - A failed ENTITLEMENT read is `unavailable`, never `locked`.
 *
 * @module services/owner-dashboard/owner-listing-dashboard.service
 */

import { ExperienceModel, VenueModel } from '@repo/db';
import {
    EntityTypeEnum,
    type EntityViewWindow,
    type OwnerDashboardVertical,
    type OwnerListingCounts,
    type OwnerListingDashboard,
    PermissionEnum,
    PublicationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceConfig, ServiceOutput } from '../../types';
import { hasPermission } from '../../utils/permission';
import { entityViewService } from '../entityView/entityView.service';

/** Window lengths in days, keyed by the accepted window value. */
const WINDOW_DAYS: Readonly<Record<EntityViewWindow, number>> = { '7d': 7, '30d': 30 };

/** Entity type each dashboard vertical reads views for. */
const ENTITY_TYPE_BY_VERTICAL = {
    venue: EntityTypeEnum.VENUE,
    experience: EntityTypeEnum.EXPERIENCE
} as const satisfies Record<
    OwnerDashboardVertical,
    EntityTypeEnum.VENUE | EntityTypeEnum.EXPERIENCE
>;

/**
 * Permission each dashboard requires: the owner's own-listing edit permission
 * of that vertical. Checked here rather than on the route because the route is
 * a closed-list `READ_OWN` route, where the unverified-email guard forbids
 * naming it (TEST:1692:7).
 */
const REQUIRED_PERMISSION_BY_VERTICAL = {
    venue: PermissionEnum.VENUE_EDIT_OWN,
    experience: PermissionEnum.EXPERIENCE_EDIT_OWN
} as const satisfies Record<OwnerDashboardVertical, PermissionEnum>;

/**
 * The slice of a listing model this aggregate depends on: a COUNT query. The
 * counts never fetch rows and have no page cap (`listOwn` stops at 100 rows,
 * so counting its result would silently under-count a larger owner).
 */
export interface OwnListingsCounter {
    /** Counts the rows matching an equality filter. */
    count(where: Record<string, unknown>): Promise<number>;
}

/** The slice of the view service this aggregate depends on. */
export interface OwnListingViewStatsReader {
    /** Per-listing view stats of every listing the actor owns. */
    getStatsForOwnListings(input: {
        readonly actor: Actor;
        readonly entityType: EntityTypeEnum.VENUE | EntityTypeEnum.EXPERIENCE;
        readonly window: EntityViewWindow;
    }): Promise<ServiceOutput<ReadonlyArray<{ readonly unique: number; readonly total: number }>>>;
}

/** Input to {@link OwnerListingDashboardService.getForOwner}. */
export interface GetOwnerListingDashboardInput {
    /** Which vertical's dashboard to build. */
    readonly vertical: OwnerDashboardVertical;
    /** Rolling traffic window. */
    readonly window: EntityViewWindow;
    /**
     * Whether the owner's effective set grants `view_basic_stats` in this
     * vertical. Resolved by the route (it owns the entitlement ports) and only
     * invoked when the traffic block is about to be read. It must THROW when the
     * set cannot be read: a failed read is `unavailable`, never `locked` (a
     * paying owner must not be shown the upsell because of a transient error).
     */
    readonly canViewTraffic: () => Promise<boolean>;
}

/** Counts an owner's non-deleted listings in total and per publication state. */
const countListings = async (
    counter: OwnListingsCounter,
    ownerId: string
): Promise<OwnerListingCounts> => {
    const scope = { ownerId, deletedAt: null };
    const [total, published, draft, archived] = await Promise.all([
        counter.count(scope),
        counter.count({ ...scope, publicationStatus: PublicationStatusEnum.PUBLISHED }),
        counter.count({ ...scope, publicationStatus: PublicationStatusEnum.DRAFT }),
        counter.count({ ...scope, publicationStatus: PublicationStatusEnum.ARCHIVED })
    ]);
    return { total, published, draft, archived };
};

/**
 * Builds the owner dashboard for the venue and experience verticals.
 */
export class OwnerListingDashboardService {
    private readonly counters: Readonly<Record<OwnerDashboardVertical, OwnListingsCounter>>;
    private readonly viewStats: OwnListingViewStatsReader;
    private readonly logger: ServiceConfig['logger'];

    constructor(
        ctx: ServiceConfig & {
            venueModel?: OwnListingsCounter;
            experienceModel?: OwnListingsCounter;
            entityViewService?: OwnListingViewStatsReader;
        } = {}
    ) {
        this.counters = {
            venue: ctx.venueModel ?? new VenueModel(),
            experience: ctx.experienceModel ?? new ExperienceModel()
        };
        this.viewStats = ctx.entityViewService ?? entityViewService;
        this.logger = ctx.logger;
    }

    /**
     * Builds the calling owner's dashboard.
     *
     * @param actor - The authenticated actor; every read is scoped to `actor.id`.
     * @param input - Vertical, window and the traffic entitlement probe.
     * @returns The dashboard, or a typed error when the listings read failed.
     */
    public async getForOwner(
        actor: Actor,
        input: GetOwnerListingDashboardInput
    ): Promise<ServiceOutput<OwnerListingDashboard>> {
        const { vertical, window, canViewTraffic } = input;

        // Error contract order: permission (403) before any data read.
        if (!hasPermission(actor, REQUIRED_PERMISSION_BY_VERTICAL[vertical])) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: `Missing ${REQUIRED_PERMISSION_BY_VERTICAL[vertical]}`
                }
            };
        }

        let listings: OwnerListingCounts;
        try {
            listings = await countListings(this.counters[vertical], actor.id);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger?.error({ vertical }, `Owner dashboard listings read failed: ${message}`);
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to read owner listings'
                }
            };
        }

        const grant = await this.resolveGrant({ canViewTraffic, vertical });
        if (grant === 'unknown') {
            return { data: { vertical, listings, trafficAccess: 'unavailable' } };
        }
        if (grant === 'denied') return { data: { vertical, listings, trafficAccess: 'locked' } };

        try {
            const views = await this.viewStats.getStatsForOwnListings({
                actor,
                entityType: ENTITY_TYPE_BY_VERTICAL[vertical],
                window
            });
            if (views.error || !views.data) {
                this.logger?.warn({ vertical }, 'Owner dashboard traffic read returned an error');
                return { data: { vertical, listings, trafficAccess: 'unavailable' } };
            }
            return {
                data: {
                    vertical,
                    listings,
                    trafficAccess: 'granted',
                    traffic: {
                        windowDays: WINDOW_DAYS[window],
                        unique: views.data.reduce((sum, row) => sum + row.unique, 0),
                        total: views.data.reduce((sum, row) => sum + row.total, 0)
                    }
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger?.warn({ vertical }, `Owner dashboard traffic read threw: ${message}`);
            return { data: { vertical, listings, trafficAccess: 'unavailable' } };
        }
    }

    /**
     * Runs the entitlement probe. A probe that throws is `unknown` (rendered
     * as `unavailable`), never `denied`: absence and failure are different.
     */
    private async resolveGrant(args: {
        readonly canViewTraffic: () => Promise<boolean>;
        readonly vertical: OwnerDashboardVertical;
    }): Promise<'granted' | 'denied' | 'unknown'> {
        try {
            return (await args.canViewTraffic()) ? 'granted' : 'denied';
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger?.warn(
                { vertical: args.vertical },
                `Owner dashboard entitlement probe failed: ${message}`
            );
            return 'unknown';
        }
    }
}
