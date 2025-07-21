import { AccommodationModel, AmenityModel, RAccommodationAmenityModel } from '@repo/db';
import type {
    AccommodationAmenityType,
    AccommodationId,
    AccommodationType,
    AmenityId,
    AmenityType
} from '@repo/types';
import { ServiceErrorCode, type VisibilityEnum } from '@repo/types';
import type { AmenitiesTypeEnum } from '@repo/types/enums/amenity-type.enum';
import type { z } from 'zod';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { ServiceOutput } from '../../types';
import { type Actor, type ServiceContext, ServiceError } from '../../types';
import { generateAmenitySlug } from './amenity.helpers';
import {
    checkCanAddAmenityToAccommodation,
    checkCanCountAmenities,
    checkCanCreateAmenity,
    checkCanDeleteAmenity,
    checkCanListAmenities,
    checkCanRemoveAmenityFromAccommodation,
    checkCanUpdateAmenity,
    checkCanViewAmenity
} from './amenity.permissions';
import type { CreateAmenityInput, SearchAmenityInput } from './amenity.schemas';
import {
    AddAmenityToAccommodationInputSchema,
    CreateAmenitySchema,
    GetAccommodationsByAmenitySchema,
    GetAmenitiesForAccommodationSchema,
    RemoveAmenityFromAccommodationInputSchema,
    SearchAmenitySchema,
    UpdateAmenitySchema
} from './amenity.schemas';

export type ServiceOutputAmenities = ServiceOutput<{ amenities: AmenityType[] }>;
export type ServiceOutputAccommodations = ServiceOutput<{ accommodations: AccommodationType[] }>;

/**
 * Service for managing amenities and their relation to accommodations.
 * Implements CRUD and amenity-accommodation relation logic.
 * @extends BaseCrudRelatedService
 */
export class AmenityService extends BaseCrudRelatedService<
    AmenityType,
    AmenityModel,
    RAccommodationAmenityModel,
    typeof CreateAmenitySchema,
    typeof UpdateAmenitySchema,
    typeof SearchAmenitySchema
> {
    static readonly ENTITY_NAME = 'amenity';
    protected readonly entityName = AmenityService.ENTITY_NAME;
    protected readonly model: AmenityModel;

    protected readonly createSchema = CreateAmenitySchema;
    protected readonly updateSchema = UpdateAmenitySchema;
    protected readonly searchSchema = SearchAmenitySchema;
    protected readonly accommodationModel: AccommodationModel;

    constructor(
        ctx: ServiceContext,
        model?: AmenityModel,
        relatedModel?: RAccommodationAmenityModel,
        accommodationModel?: AccommodationModel
    ) {
        super(ctx, AmenityService.ENTITY_NAME, relatedModel);
        this.model = model ?? new AmenityModel();
        this.accommodationModel = accommodationModel ?? new AccommodationModel();
    }

    protected createDefaultRelatedModel(): RAccommodationAmenityModel {
        return new RAccommodationAmenityModel();
    }

    // --- Permission Hooks ---
    protected _canCreate(actor: Actor, _data: CreateAmenityInput): void {
        checkCanCreateAmenity(actor);
    }
    protected _canUpdate(actor: Actor, _entity: AmenityType): void {
        checkCanUpdateAmenity(actor, _entity);
    }
    protected _canSoftDelete(actor: Actor, entity: AmenityType): void {
        checkCanDeleteAmenity(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: AmenityType): void {
        checkCanDeleteAmenity(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: AmenityType): void {
        checkCanUpdateAmenity(actor, entity);
    }
    protected _canView(actor: Actor, entity: AmenityType): void {
        checkCanViewAmenity(actor, entity);
    }
    protected _canList(actor: Actor): void {
        checkCanListAmenities(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanListAmenities(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanCountAmenities(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        entity: AmenityType,
        _newVisibility: VisibilityEnum
    ): void {
        checkCanUpdateAmenity(actor, entity);
    }
    protected _canAddAmenityToAccommodation(actor: Actor): void {
        checkCanAddAmenityToAccommodation(actor);
    }
    protected _canRemoveAmenityFromAccommodation(actor: Actor): void {
        checkCanRemoveAmenityFromAccommodation(actor);
    }

    // TODO: Implement permission hooks, normalizers, and custom methods as needed.
    // Stubs for custom methods:
    /**
     * Retrieves all accommodations that have a specific amenity.
     * @param actor - The actor performing the action
     * @param params - The params containing the amenity ID
     * @returns A ServiceOutput object containing an array of accommodations with the specified amenity, or an error if the amenity does not exist or the actor lacks permission.
     * @throws {ServiceError} If the actor lacks permission or the amenity does not exist.
     */
    public async getAccommodationsByAmenity(
        actor: Actor,
        params: z.infer<typeof GetAccommodationsByAmenitySchema>
    ): Promise<ServiceOutput<{ accommodations: AccommodationType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAccommodationsByAmenity',
            input: { ...params, actor },
            schema: GetAccommodationsByAmenitySchema,
            execute: async (validatedParams, actor) => {
                this._canList(actor);
                const { amenityId } = validatedParams;
                const amenity = await this.model.findOne({ id: amenityId as AmenityId });
                if (!amenity) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Amenity not found');
                }
                const { items: relations } = await this.relatedModel.findAll({ amenityId });
                const accommodationIds = relations.map((r) => r.accommodationId);
                if (accommodationIds.length === 0) {
                    return { accommodations: [] };
                }
                const accommodationModel = this.accommodationModel ?? new AccommodationModel();
                const { items: accommodations } = await accommodationModel.findAll({
                    id: accommodationIds
                });
                return { accommodations };
            }
        });
    }
    /**
     * Retrieves all amenities for a given accommodation.
     * @param actor - The actor performing the action
     * @param params - The params containing the accommodation ID
     * @returns A ServiceOutput object containing an array of amenities for the specified accommodation, or an error if the actor lacks permission.
     * @throws {ServiceError} If the actor lacks permission.
     */
    public async getAmenitiesForAccommodation(
        actor: Actor,
        params: z.infer<typeof GetAmenitiesForAccommodationSchema>
    ): Promise<ServiceOutput<{ amenities: AmenityType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAmenitiesForAccommodation',
            input: { ...params, actor },
            schema: GetAmenitiesForAccommodationSchema,
            execute: async (validatedParams, actor) => {
                this._canList(actor);
                const { accommodationId } = validatedParams;
                // Find all relations with this accommodationId
                const { items: relations } = await this.relatedModel.findAll({ accommodationId });
                const amenityIds = relations.map((r) => r.amenityId);
                if (amenityIds.length === 0) {
                    return { amenities: [] };
                }
                // Find all amenities by their IDs
                const { items: amenities } = await this.model.findAll({ id: amenityIds });
                return { amenities };
            }
        });
    }
    /**
     * Adds an amenity to an accommodation, ensuring validation, permissions, and uniqueness.
     * @param actor - The actor performing the action
     * @param params - The params required to add the amenity to the accommodation
     * @returns A ServiceOutput object containing the created relation if successful, or an error if the operation fails.
     * @throws {ServiceError} If the actor lacks permission, the amenity or accommodation does not exist, or the relation already exists.
     */
    public async addAmenityToAccommodation(
        actor: Actor,
        params: z.infer<typeof AddAmenityToAccommodationInputSchema>
    ): Promise<ServiceOutput<{ relation: AccommodationAmenityType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addAmenityToAccommodation',
            input: { ...params, actor },
            schema: AddAmenityToAccommodationInputSchema,
            execute: async (validatedParams, actor) => {
                this._canAddAmenityToAccommodation(actor);
                const {
                    accommodationId,
                    amenityId,
                    isOptional = false,
                    additionalCost,
                    additionalCostPercent
                } = validatedParams;
                // Verify amenity exists
                const amenity = await this.model.findOne({ id: amenityId as AmenityId });
                if (!amenity) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Amenity not found');
                }
                const accommodation = await this.accommodationModel.findOne({
                    id: accommodationId as AccommodationId
                });
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                // Verify that the relation does not already exist
                const existing = await this.relatedModel.findOne({
                    accommodationId: accommodationId as AccommodationId,
                    amenityId: amenityId as AmenityId
                });
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'Amenity already added to accommodation'
                    );
                }
                // Create the relation
                const relation = await this.relatedModel.create({
                    accommodationId: accommodationId as AccommodationId,
                    amenityId: amenityId as AmenityId,
                    isOptional,
                    additionalCost,
                    additionalCostPercent
                });
                return { relation };
            }
        });
    }
    /**
     * Removes an amenity from an accommodation.
     * @param actor - The actor performing the action
     * @param params - The params required to remove the amenity from the accommodation
     * @returns A ServiceOutput object containing the deleted relation if successful, or an error if the operation fails.
     * @throws {ServiceError} If the actor lacks permission, the amenity or relation does not exist, or the deletion fails.
     */
    public async removeAmenityFromAccommodation(
        actor: Actor,
        params: z.infer<typeof RemoveAmenityFromAccommodationInputSchema>
    ): Promise<ServiceOutput<{ relation: AccommodationAmenityType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeAmenityFromAccommodation',
            input: { ...params, actor },
            schema: RemoveAmenityFromAccommodationInputSchema,
            execute: async (validatedParams, actor) => {
                this._canRemoveAmenityFromAccommodation(actor);
                const { accommodationId, amenityId } = validatedParams;
                // Verify amenity exists
                const amenity = await this.model.findOne({ id: amenityId as AmenityId });
                if (!amenity) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Amenity not found');
                }
                // Verify relation exists
                const existing = await this.relatedModel.findOne({
                    accommodationId: accommodationId as AccommodationId,
                    amenityId: amenityId as AmenityId
                });
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Amenity relation not found for this accommodation'
                    );
                }
                // Remove relation using softDelete and ensure it returns non-null
                const softDeleted = await this.relatedModel.softDelete({
                    accommodationId: accommodationId as AccommodationId,
                    amenityId: amenityId as AmenityId
                });
                if (!softDeleted) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to delete amenity relation'
                    );
                }
                return {
                    relation: {
                        ...existing,
                        deletedAt: new Date()
                    }
                };
            }
        });
    }

    /**
     * Executes a search for amenities based on the provided parameters and actor.
     *
     * @param params - The search parameters (filters, pagination, sorting).
     * @param _actor - The actor performing the search.
     * @returns An object containing the search results, page, pageSize, and total count.
     */
    protected async _executeSearch(params: SearchAmenityInput, _actor: Actor) {
        const { filters = {}, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        return this.model.findAll(filters, { page, pageSize });
    }

    /**
     * Executes a count of amenities based on the provided parameters and actor.
     *
     * @param params - The search parameters (filters).
     * @param _actor - The actor performing the count.
     * @returns An object containing the count of amenities.
     */
    protected async _executeCount(params: SearchAmenityInput, _actor: Actor) {
        const { filters = {} } = params;
        const count = await this.model.count(filters);
        return { count };
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before creating an amenity.
     * If slug is not provided, generates a unique slug from the name.
     */
    protected async _beforeCreate(
        data: z.infer<typeof CreateAmenitySchema>,
        _actor: Actor
    ): Promise<Partial<AmenityType>> {
        let slug = data.slug;
        if (!slug && data.name) {
            slug = await generateAmenitySlug(data.name, this.model);
        }
        // Cast type to AmenitiesTypeEnum
        const type = data.type as AmenitiesTypeEnum;
        return { ...data, slug, type };
    }

    /**
     * Lifecycle hook: normalizes input and updates slug if name changes.
     * If name is updated and slug is not provided, regenerates slug from new name.
     */
    protected async _beforeUpdate(
        data: z.infer<typeof UpdateAmenitySchema>,
        _actor: Actor
    ): Promise<Partial<AmenityType>> {
        let slug = data.slug;
        const type = data.type ? (data.type as AmenitiesTypeEnum) : undefined;
        // If name is being updated and slug is not provided, fetch entity to compare
        if (!slug && data.name) {
            let entity: AmenityType | undefined = undefined;
            if ('id' in data && data.id) {
                const found = await this.model.findById(data.id as AmenityId);
                entity = found ?? undefined;
            }
            if (!entity || (entity && data.name !== entity.name)) {
                slug = await generateAmenitySlug(data.name, this.model);
            }
        }
        return { ...data, slug, type };
    }
}
