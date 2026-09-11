/**
 * The partner's own in-platform statistics (HOS-1063 A-3 / A-4).
 *
 * Two responsibilities, and they sit at opposite ends of the same feature:
 * {@link PartnerStatsService.captureLogoClick} is the public write behind the
 * carousel beacon, and {@link PartnerStatsService.getForOwner} is the
 * owner-facing read behind `GET /protected/partners/mine/stats`.
 *
 * ## Deliberately NOT a `BaseCrudService`
 *
 * There is no CRUD surface here. `partner_logo_clicks` is append-only telemetry
 * with no update, no soft delete and no list-by-id, and the read is one
 * aggregate scoped to the caller. The same reasoning that made
 * `EntityViewService`'s model standalone applies to the service above it.
 *
 * ## Authorisation is OWNERSHIP, not permission and not entitlement
 *
 * `getForOwner` declares no permission for the reason `mine-mentions` records
 * (HOS-278 AC-7): an approved partner is an ordinary account, so demanding a
 * `PARTNER_*` perk would lock them out of their own numbers. And it declares no
 * entitlement because `loadEntitlements` resolves against the ACCOMMODATION
 * subscription (§5.6) — an entitlement gate here would refuse every partner who
 * is not also a paying host, and admit a host who is not a partner.
 *
 * It fails CLOSED in the same shape as the mentions log: a guest and an actor
 * who owns no partner both receive `{ available: false }`, never a 403 that
 * would confirm a partner exists.
 *
 * ## What this service does NOT decide
 *
 * Which cards the panel renders. That is `resolvePartnerLogoLink`'s job in
 * `apps/web`, and duplicating it here would create the second source of truth
 * §7.2 exists to prevent. This service returns numbers and the fields needed to
 * call that function.
 *
 * @module services/partner/partner-stats.service
 */

import { EntityViewModel, PartnerLogoClickModel, PartnerModel } from '@repo/db';
import {
    EntityTypeEnum,
    type PartnerLogoClickDestination,
    type PartnerStats,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';

/**
 * Resolves the user id an ownership filter may be built from, or `null`.
 *
 * Copied in spirit from `resolveMentionOwnerUserId`, and for the same reason: a
 * GUEST actor carries a REAL UUID (the repo-wide error contract says so), so
 * `!actor?.id` is not an anonymity test. An actor holding no roles, or only
 * `GUEST`, must never reach a `WHERE ownerUserId = …` clause, because that
 * clause would then be built from a value that could coincidentally match a row.
 */
const resolveStatsOwnerUserId = (actor: Actor): string | null => {
    const isAnonymous =
        actor.roles.length === 0 || actor.roles.every((role: RoleEnum) => role === RoleEnum.GUEST);
    return isAnonymous ? null : actor.id;
};

/** Input to {@link PartnerStatsService.captureLogoClick}. */
export interface CaptureLogoClickInput {
    /** UUID of the partner whose logo was clicked. */
    readonly partnerId: string;
    /**
     * Salted visitor fingerprint, computed by the ROUTE from the request. Never
     * accepted from the client — a caller who could supply it could forge a
     * distinct visitor on every click and inflate the `unique` count at will.
     */
    readonly visitorHash: string;
    /** Which linking branch the click followed. */
    readonly destination: PartnerLogoClickDestination;
}

/** Input to {@link PartnerStatsService.getForOwner}. */
export interface GetPartnerStatsInput {
    /** Rolling window in days. The route constrains this to 7 or 30. */
    readonly windowDays: number;
}

/**
 * Service for the partner's in-platform statistics.
 */
export class PartnerStatsService {
    private readonly clickModel: PartnerLogoClickModel;
    private readonly viewModel: EntityViewModel;
    private readonly partnerModel: PartnerModel;
    private readonly logger: ServiceConfig['logger'];

    constructor(
        ctx: ServiceConfig & {
            clickModel?: PartnerLogoClickModel;
            viewModel?: EntityViewModel;
            partnerModel?: PartnerModel;
        }
    ) {
        this.clickModel = ctx.clickModel ?? new PartnerLogoClickModel();
        this.viewModel = ctx.viewModel ?? new EntityViewModel();
        this.partnerModel = ctx.partnerModel ?? new PartnerModel();
        this.logger = ctx.logger;
    }

    /**
     * Records one logo click.
     *
     * Fire-and-forget by contract: the caller (a public endpoint) answers 202
     * whatever happens here, so a failure must be returned as a typed error and
     * logged, never thrown into a public page's request.
     *
     * The partner id is NOT validated against the `partners` table first. The FK
     * does that, atomically, and a pre-flight existence check would turn this
     * one-statement write into two round-trips on a hot public path — while also
     * handing a caller an oracle for probing which partner ids exist, by timing.
     *
     * @param input - partnerId, server-computed visitorHash, destination.
     * @returns `{ data: { recorded: true } }`, or a typed error.
     */
    public async captureLogoClick(
        input: CaptureLogoClickInput
    ): Promise<ServiceOutput<{ recorded: true }>> {
        try {
            await this.clickModel.insertClick({
                partnerId: input.partnerId,
                visitorHash: input.visitorHash,
                destination: input.destination
            });

            return { data: { recorded: true } };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // `visitorHash` is deliberately absent from this log line: it is the
            // privacy-sensitive half of the row and the same omission the view
            // capture path makes (docs/guides/view-tracking-privacy.md).
            this.logger?.error(
                { partnerId: input.partnerId, destination: input.destination },
                `Partner logo click capture failed: ${message}`
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to record partner logo click'
                }
            };
        }
    }

    /**
     * The calling partner's own numbers over a rolling window.
     *
     * Fails closed at two points, and both are ordinary states rather than
     * errors: an anonymous actor never reaches the ownership filter, and an
     * actor who owns no partner resolves to no row. Both answer
     * `{ available: false }`.
     *
     * Both metrics are always returned when a partner resolves, INCLUDING for a
     * partner whose logo links nowhere and who therefore cannot receive clicks.
     * That is not an oversight: the honest count of a thing that did not happen
     * is zero, and it is the panel — not this service — that must decline to
     * render a card whose surface does not exist (G-3, §7.2). Suppressing the
     * number here would move that decision away from the one function that reads
     * the same rules the carousel does.
     *
     * @param actor - The authenticated actor.
     * @param input - The rolling window in days.
     * @param ctx - Optional service context.
     * @returns The stats payload, or `{ available: false }`.
     */
    public async getForOwner(
        actor: Actor,
        input: GetPartnerStatsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PartnerStats>> {
        try {
            const ownerUserId = resolveStatsOwnerUserId(actor);
            if (ownerUserId === null) return { data: { available: false } };

            const partner = await this.partnerModel.findOne({ ownerUserId }, ctx?.tx);
            if (!partner) return { data: { available: false } };

            const partnerId = partner.id as string;
            const { windowDays } = input;

            const [viewStats, clickStats] = await Promise.all([
                this.viewModel.getStatsForEntities(
                    {
                        entityType: EntityTypeEnum.PARTNER,
                        entityIds: [partnerId],
                        windowDays
                    },
                    ctx?.tx
                ),
                this.clickModel.getStatsForPartner({ partnerId, windowDays }, ctx?.tx)
            ]);

            // `getStatsForEntities` OMITS entities with no rows in the window
            // rather than returning zeros — its documented contract, and the
            // reason the zero-fill lives here. Without it a partner with no
            // views yet would reach the panel as `undefined`, which renders as
            // a blank where a number belongs.
            const views = viewStats[0] ?? { unique: 0, total: 0 };

            return {
                data: {
                    available: true,
                    partner: {
                        id: partnerId,
                        name: String(partner.name ?? ''),
                        slug: partner.slug == null ? undefined : String(partner.slug),
                        tier: partner.tier == null ? undefined : String(partner.tier),
                        websiteUrl:
                            partner.websiteUrl == null ? undefined : String(partner.websiteUrl)
                    },
                    windowDays,
                    views: { unique: views.unique, total: views.total },
                    clicks: { unique: clickStats.unique, total: clickStats.total }
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger?.error(
                { windowDays: input.windowDays },
                `Partner stats read failed: ${message}`
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to read partner statistics'
                }
            };
        }
    }
}
