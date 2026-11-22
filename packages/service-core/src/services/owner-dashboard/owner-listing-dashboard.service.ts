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
 * There is no CRUD surface: this is one read aggregate that composes
 * `listOwn` and `EntityViewService.getStatsForOwnListings`.
 *
 * ## Ownership is structural
 *
 * No listing or owner id is accepted. Both reads receive only the caller's
 * actor and scope themselves to `ownerId = actor.id`, so another owner's
 * listings can never be counted.
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
 *
 * @module services/owner-dashboard/owner-listing-dashboard.service
 */

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
import { ExperienceService } from '../experience/experience.service';
import { VenueService } from '../venue/venue.service';

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

/** Minimal listing shape the dashboard counts. */
interface CountableListing {
    readonly publicationStatus?: string | null;
}

/** The slice of a listing service this aggregate depends on. */
export interface OwnListingsReader {
    /** Lists every non-deleted listing owned by the actor. */
    listOwn(actor: Actor): Promise<ServiceOutput<{ listings: readonly CountableListing[] }>>;
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
     * invoked when the traffic block is about to be read.
     */
    readonly canViewTraffic: () => Promise<boolean>;
}

/** Counts listings by publication state; `total` includes every state. */
const countListings = (listings: readonly CountableListing[]): OwnerListingCounts => ({
    total: listings.length,
    published: listings.filter((l) => l.publicationStatus === PublicationStatusEnum.PUBLISHED)
        .length,
    draft: listings.filter((l) => l.publicationStatus === PublicationStatusEnum.DRAFT).length,
    archived: listings.filter((l) => l.publicationStatus === PublicationStatusEnum.ARCHIVED).length
});

/**
 * Builds the owner dashboard for the venue and experience verticals.
 */
export class OwnerListingDashboardService {
    private readonly readers: Readonly<Record<OwnerDashboardVertical, OwnListingsReader>>;
    private readonly viewStats: OwnListingViewStatsReader;
    private readonly logger: ServiceConfig['logger'];

    constructor(
        ctx: ServiceConfig & {
            venueService?: OwnListingsReader;
            experienceService?: OwnListingsReader;
            entityViewService?: OwnListingViewStatsReader;
        } = {}
    ) {
        this.readers = {
            venue: ctx.venueService ?? new VenueService(ctx),
            experience: ctx.experienceService ?? new ExperienceService(ctx)
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
            const result = await this.readers[vertical].listOwn(actor);
            if (result.error) return { error: result.error };
            listings = countListings(result.data?.listings ?? []);
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

        const granted = await this.resolveGrant({ canViewTraffic, vertical });
        if (!granted) return { data: { vertical, listings, trafficAccess: 'locked' } };

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

    /** Runs the entitlement probe; a probe that throws grants nothing. */
    private async resolveGrant(args: {
        readonly canViewTraffic: () => Promise<boolean>;
        readonly vertical: OwnerDashboardVertical;
    }): Promise<boolean> {
        try {
            return await args.canViewTraffic();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger?.warn(
                { vertical: args.vertical },
                `Owner dashboard entitlement probe failed: ${message}`
            );
            return false;
        }
    }
}
