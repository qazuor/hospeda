/**
 * Venue promotions (HOS-2270): the owner's create, read, edit and delete of the
 * promotions of one venue.
 *
 * A venue promotion lives in the same table as an accommodation one
 * (`owner_promotions`) and goes through the same {@link OwnerPromotionService}
 * lifecycle, but its inputs are different: no `minNights`, no redemption cap, one
 * extra benefit type (`special_offer`, free text kept in `description`). This module
 * is the translation layer between the venue request schemas and the service's
 * create/update contract, and it owns the ownership rule of the venue routes: the
 * venue must be the actor's, and a promotion is reachable only through the venue it
 * hangs from. Everything that is not the owner's answers the same `NOT_FOUND`.
 *
 * What the plan allows (entitlement and quota) is not decided here: the route's
 * listing-access pipeline does it before this runs.
 *
 * @module services/owner-promotion/ownerPromotion.venue
 */
import { OwnerPromotionModel, VenueModel } from '@repo/db';
import type {
    OwnerPromotion,
    OwnerPromotionCreateInput,
    OwnerPromotionUpdateInput,
    VenuePromotionCreateRequest,
    VenuePromotionUpdateRequest
} from '@repo/schemas';
import {
    fromPromotionWindow,
    LifecycleStatusEnum,
    OwnerPromotionDiscountTypeEnum,
    OwnerPromotionEntityTypeEnum,
    ServiceErrorCode,
    TouristAudienceEnum,
    toPromotionWindow
} from '@repo/schemas';
import type { Actor, ServiceConfig, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { entityNotFoundError } from '../../utils/not-found';
import {
    resolveListingDestinationSlug,
    scheduleListingRevalidation,
    standaloneListingRevalidationLogger
} from '../listing/listing-revalidation';
import { checkCanList } from './ownerPromotion.permissions';
import { OwnerPromotionService } from './ownerPromotion.service';

/** A venue's promotions and how many of them hold a slot of the owner's quota. */
export interface VenuePromotionList {
    readonly items: readonly OwnerPromotion[];
    /** Venue promotions of the OWNER (all their venues) that hold a quota slot. */
    readonly activeCount: number;
}

/** Throws a 400 with the given zod-style message key. */
function invalid(message: string): never {
    throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, message);
}

/** Validates a numeric benefit against its type (percentage 1..100, fixed >= 1). */
function assertBenefitValue(args: {
    readonly discountType: OwnerPromotionDiscountTypeEnum;
    readonly discountValue: number;
}): void {
    const { discountType, discountValue } = args;
    if (discountType === OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER) {
        if (discountValue !== 0)
            invalid('zodError.ownerPromotion.discountValue.notForSpecialOffer');
        return;
    }
    if (discountValue < 1) invalid('zodError.ownerPromotion.discountValue.min');
    if (discountType === OwnerPromotionDiscountTypeEnum.PERCENTAGE && discountValue > 100) {
        invalid('zodError.ownerPromotion.discountValue.maxPercentage');
    }
}

/**
 * Translates a venue create request into the service's create input.
 *
 * `ownerId`, `entityType` and `entityId` come from the caller (the session and the
 * route), never from the request body. A `special_offer` keeps its text in
 * `description` and has a `discountValue` of 0.
 *
 * @param args.venue - The venue (its id and owner).
 * @param args.request - The validated request body.
 * @returns The input for {@link OwnerPromotionService.create}.
 */
export function buildVenueCreateInput(args: {
    readonly venue: { readonly id: string; readonly ownerId: string };
    readonly request: VenuePromotionCreateRequest;
}): OwnerPromotionCreateInput {
    const { venue, request } = args;
    const isSpecial = request.discountType === OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER;
    return {
        ownerId: venue.ownerId,
        entityType: OwnerPromotionEntityTypeEnum.VENUE,
        entityId: venue.id,
        accommodationId: null,
        title: request.title,
        description: isSpecial ? (request.specialOfferText ?? null) : (request.description ?? null),
        discountType: request.discountType,
        discountValue: isSpecial ? 0 : (request.discountValue ?? 0),
        minNights: null,
        maxRedemptions: null,
        validFrom: request.validFrom,
        validUntil: request.validUntil ?? null,
        ...fromPromotionWindow(request.window),
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        // HOS-2589 D-4: «Para todos» by default; «Solo VIP» is gated at the route.
        touristAudience: request.touristAudience ?? TouristAudienceEnum.PLUS
    };
}

/**
 * Translates a venue update request into the service's update input, checking the
 * RESULTING promotion (the stored one plus the change) rather than the body alone.
 *
 * @param args.existing - The stored promotion.
 * @param args.request - The validated partial request.
 * @returns The input for {@link OwnerPromotionService.update}.
 * @throws {ServiceError} VALIDATION_ERROR when the resulting promotion is invalid.
 */
export function buildVenueUpdateInput(args: {
    readonly existing: OwnerPromotion;
    readonly request: VenuePromotionUpdateRequest;
}): OwnerPromotionUpdateInput {
    const { existing, request } = args;
    const finalType = request.discountType ?? existing.discountType;
    const isSpecial = finalType === OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER;
    const changesType = request.discountType !== undefined;
    const input: OwnerPromotionUpdateInput = {};

    if (request.title !== undefined) input.title = request.title;
    if (request.validFrom !== undefined) input.validFrom = request.validFrom;
    if (request.validUntil !== undefined) input.validUntil = request.validUntil;
    if (request.window !== undefined) Object.assign(input, fromPromotionWindow(request.window));
    if (request.lifecycleState !== undefined) input.lifecycleState = request.lifecycleState;
    if (request.touristAudience !== undefined) input.touristAudience = request.touristAudience;
    if (changesType) input.discountType = request.discountType;

    if (request.specialOfferText !== undefined && !isSpecial) {
        invalid('zodError.ownerPromotion.specialOfferText.onlyForSpecialOffer');
    }
    if (isSpecial) {
        if (request.specialOfferText !== undefined) input.description = request.specialOfferText;
        else if (request.description !== undefined) input.description = request.description;
        if (changesType || request.discountValue !== undefined) {
            assertBenefitValue({
                discountType: finalType,
                discountValue: request.discountValue ?? 0
            });
            input.discountValue = 0;
        }
    } else {
        // Leaving `special_offer` drops its text: it is not a description.
        const wasSpecial = existing.discountType === OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER;
        if (request.description !== undefined) input.description = request.description;
        else if (changesType && wasSpecial) input.description = null;
        if (request.discountValue !== undefined || (changesType && wasSpecial)) {
            const value = request.discountValue ?? existing.discountValue;
            assertBenefitValue({ discountType: finalType, discountValue: value });
            input.discountValue = value;
        }
    }

    const from = request.validFrom ?? existing.validFrom;
    const until = request.validUntil === undefined ? existing.validUntil : request.validUntil;
    if (until && new Date(until).getTime() <= new Date(from).getTime()) {
        invalid('zodError.ownerPromotion.validUntil.beforeValidFrom');
    }
    // Validate the resulting window too: an omitted update preserves the stored value.
    const resultingWindow =
        request.window === undefined ? toPromotionWindow(existing) : request.window;
    if (
        resultingWindow &&
        (resultingWindow.startTime === resultingWindow.endTime ||
            new Set(resultingWindow.weekdays).size !== resultingWindow.weekdays.length)
    ) {
        invalid('zodError.ownerPromotion.window.invalid');
    }
    return input;
}

/**
 * Service of the promotions of one venue. Owner-only: a venue that is not the
 * actor's is a `NOT_FOUND`, byte-identical to a venue that does not exist.
 */
export class VenuePromotionService {
    private readonly promotions: OwnerPromotionService;
    private readonly model: OwnerPromotionModel;
    private readonly venueModel: VenueModel;

    constructor(
        ctx: ServiceConfig & {
            promotionService?: OwnerPromotionService;
            model?: OwnerPromotionModel;
            venueModel?: VenueModel;
        } = {}
    ) {
        this.promotions = ctx.promotionService ?? new OwnerPromotionService(ctx);
        this.model = ctx.model ?? new OwnerPromotionModel();
        this.venueModel = ctx.venueModel ?? new VenueModel();
    }

    /** Runs `fn` and turns a thrown {@link ServiceError} into a `ServiceOutput` error. */
    private async guard<T>(fn: () => Promise<T>): Promise<ServiceOutput<T>> {
        try {
            return { data: await fn() };
        } catch (error) {
            if (error instanceof ServiceError) return { error };
            throw error;
        }
    }

    /** Loads the venue and checks it is the actor's. Anything else is a 404. */
    private async loadOwnedVenue(args: { readonly actor: Actor; readonly venueId: string }) {
        const venue = await this.venueModel.findById(args.venueId);
        if (!venue || venue.deletedAt || venue.ownerId !== args.actor.id) {
            throw entityNotFoundError({ entityName: 'venue' });
        }
        return venue;
    }

    /** Loads a promotion of the venue, or the same 404 as a missing or foreign one. */
    private async loadVenuePromotion(args: {
        readonly actor: Actor;
        readonly venueId: string;
        readonly promotionId: string;
    }): Promise<{
        venue: Awaited<ReturnType<VenuePromotionService['loadOwnedVenue']>>;
        promotion: OwnerPromotion;
    }> {
        const venue = await this.loadOwnedVenue(args);
        const promotion = await this.model.findOneOfVenue({
            promotionId: args.promotionId,
            venueId: args.venueId
        });
        if (!promotion || promotion.ownerId !== args.actor.id) {
            throw entityNotFoundError({ entityName: 'ownerPromotion' });
        }
        return { venue, promotion };
    }

    /** Purges the venue's cached public page and lists after a promotion write. */
    private async revalidate(venue: Awaited<ReturnType<VenuePromotionService['loadOwnedVenue']>>) {
        await scheduleListingRevalidation({
            entityType: 'venue',
            entity: venue,
            resolveDestinationSlug: resolveListingDestinationSlug,
            logger: standaloneListingRevalidationLogger
        });
    }

    /**
     * Lists every promotion of the venue (any state) and the owner's quota usage.
     *
     * @param args.actor - The owner.
     * @param args.venueId - The venue.
     */
    public async list(args: {
        readonly actor: Actor;
        readonly venueId: string;
    }): Promise<ServiceOutput<VenuePromotionList>> {
        return this.guard(async () => {
            checkCanList(args.actor);
            await this.loadOwnedVenue(args);
            const [items, activeCount] = await Promise.all([
                this.model.findByVenue({ venueId: args.venueId }),
                this.model.countActiveForVenueOwner({ ownerId: args.actor.id })
            ]);
            return { items, activeCount };
        });
    }

    /**
     * Creates a promotion of the venue, owned by the venue's owner.
     *
     * @param args.actor - The owner.
     * @param args.venueId - The venue.
     * @param args.request - The validated create request.
     */
    public async create(args: {
        readonly actor: Actor;
        readonly venueId: string;
        readonly request: VenuePromotionCreateRequest;
    }): Promise<ServiceOutput<OwnerPromotion>> {
        return this.guard(async () => {
            const venue = await this.loadOwnedVenue(args);
            const created = await this.promotions.create(
                args.actor,
                buildVenueCreateInput({ venue, request: args.request })
            );
            if (created.error) throw created.error;
            await this.revalidate(venue);
            return created.data;
        });
    }

    /**
     * Edits a promotion of the venue (PUT and PATCH, including pause and re-activate).
     *
     * @param args.actor - The owner.
     * @param args.venueId - The venue the promotion must hang from.
     * @param args.promotionId - The promotion.
     * @param args.request - The validated partial request.
     */
    public async update(args: {
        readonly actor: Actor;
        readonly venueId: string;
        readonly promotionId: string;
        readonly request: VenuePromotionUpdateRequest;
    }): Promise<ServiceOutput<OwnerPromotion>> {
        return this.guard(async () => {
            const { venue, promotion } = await this.loadVenuePromotion(args);
            const updated = await this.promotions.update(
                args.actor,
                promotion.id,
                buildVenueUpdateInput({ existing: promotion, request: args.request })
            );
            if (updated.error) throw updated.error;
            await this.revalidate(venue);
            return updated.data;
        });
    }

    /**
     * Soft-deletes a promotion of the venue.
     *
     * @param args.actor - The owner.
     * @param args.venueId - The venue the promotion must hang from.
     * @param args.promotionId - The promotion.
     */
    public async softDelete(args: {
        readonly actor: Actor;
        readonly venueId: string;
        readonly promotionId: string;
    }): Promise<ServiceOutput<{ readonly count: number }>> {
        return this.guard(async () => {
            const { venue, promotion } = await this.loadVenuePromotion(args);
            const deleted = await this.promotions.softDelete(args.actor, promotion.id);
            if (deleted.error) throw deleted.error;
            await this.revalidate(venue);
            return deleted.data;
        });
    }
}
