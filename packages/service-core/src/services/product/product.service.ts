import { type PricingPlan, ProductModel, type ProductWithPlans } from '@repo/db';
import type { ListRelationsConfig, ProductTypeEnum } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode, type VisibilityEnum } from '@repo/schemas';
import type { Product } from '@repo/schemas/entities/product';
import {
    ProductCreateInputSchema,
    ProductSearchSchema,
    ProductUpdateInputSchema
} from '@repo/schemas/entities/product';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing products. Implements business logic, permissions, and hooks for Product entities.
 * @extends BaseCrudService
 */
export class ProductService extends BaseCrudService<
    Product,
    ProductModel,
    typeof ProductCreateInputSchema,
    typeof ProductUpdateInputSchema,
    typeof ProductSearchSchema
> {
    static readonly ENTITY_NAME = 'product';
    protected readonly entityName = ProductService.ENTITY_NAME;
    public readonly model: ProductModel;

    public readonly createSchema = ProductCreateInputSchema;
    public readonly updateSchema = ProductUpdateInputSchema;
    public readonly searchSchema = ProductSearchSchema;

    /**
     * Initializes a new instance of the ProductService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional ProductModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: ProductModel) {
        super(ctx, ProductService.ENTITY_NAME);
        this.model = model ?? new ProductModel();
    }

    /**
     * Returns default list relations (no relations for product)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a product.
     * Only ADMIN and users with PRODUCT_CREATE permission can create products.
     * @param actor - The user or system performing the action.
     * @param _data - The validated input data for the new product.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.PRODUCT_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with PRODUCT_CREATE can create products'
            );
        }
    }

    /**
     * Checks if the actor can update a product.
     * Admin or PRODUCT_UPDATE permission holders can update.
     * @param actor - The user or system performing the action.
     * @param _entity - The product entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, _entity: Product): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PRODUCT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update products'
            );
        }
    }

    /**
     * Checks if the actor can soft-delete a product.
     * Only ADMIN and users with PRODUCT_DELETE permission can soft-delete products.
     * @param actor - The user or system performing the action.
     * @param _entity - The product entity to be soft-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, _entity: Product): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.PRODUCT_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can delete products'
            );
        }
    }

    /**
     * Checks if the actor can hard-delete a product.
     * Only SUPER_ADMIN can hard-delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The product entity to be hard-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: Product): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only super admins can permanently delete products'
            );
        }
    }

    /**
     * Checks if the actor can restore a product.
     * Only ADMIN can restore.
     * @param actor - The user or system performing the action.
     * @param _entity - The product entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: Product): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can restore products'
            );
        }
    }

    /**
     * Checks if the actor can view a product.
     * Authenticated users can view products.
     * @param actor - The user or system performing the action.
     * @param _entity - The product entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, _entity: Product): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to view products'
            );
        }
    }

    /**
     * Checks if the actor can list products.
     * Any authenticated user can list products.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to list products'
            );
        }
    }

    /**
     * Checks if the actor can search products.
     * Any authenticated user can search.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to search products'
            );
        }
    }

    /**
     * Checks if the actor can count products.
     * Any authenticated user can count.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to count products'
            );
        }
    }

    /**
     * Checks if the actor can update the visibility of a product.
     * Only ADMIN can update visibility.
     * @param actor - The user or system performing the action.
     * @param _entity - The product entity to be updated.
     * @param _newVisibility - The new visibility state.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: Product,
        _newVisibility: VisibilityEnum
    ): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can update product visibility'
            );
        }
    }

    // ============================================================================
    // SEARCH & COUNT IMPLEMENTATION
    // ============================================================================

    /**
     * Executes the database search for products.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the search.
     * @returns A paginated list of products matching the criteria.
     * @protected
     */
    protected async _executeSearch(params: Record<string, unknown>, _actor: Actor) {
        const { page = 1, pageSize = 10, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the database count for products.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the count.
     * @returns An object containing the total count of products matching the criteria.
     * @protected
     */
    protected async _executeCount(params: Record<string, unknown>, _actor: Actor) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // ============================================================================
    // BUSINESS LOGIC METHODS
    // ============================================================================

    /**
     * Finds products by type.
     * @param actor - The user or system performing the action.
     * @param type - The product type to search for.
     * @returns ServiceOutput containing the products array.
     */
    public async findByType(
        actor: Actor,
        type: ProductTypeEnum
    ): Promise<ServiceOutput<Product[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByType',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query - model method returns Product[] directly
                const products = await this.model.findByType(type, undefined);

                return products;
            }
        });
    }

    /**
     * Finds all active products.
     * @param actor - The user or system performing the action.
     * @returns ServiceOutput containing array of active products.
     */
    public async findActive(actor: Actor): Promise<ServiceOutput<Product[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query - model method returns Product[] directly
                const products = await this.model.findActive(undefined);

                return products;
            }
        });
    }

    /**
     * Finds featured products.
     * @param actor - The user or system performing the action.
     * @returns ServiceOutput containing array of featured products.
     */
    public async findFeatured(actor: Actor): Promise<ServiceOutput<Product[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findFeatured',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const products = await this.model.findFeatured(undefined);

                return products;
            }
        });
    }

    /**
     * Finds products by category.
     * @param actor - The user or system performing the action.
     * @param category - The category to search in metadata.
     * @returns ServiceOutput containing products in the category.
     */
    public async findByCategory(actor: Actor, category: string): Promise<ServiceOutput<Product[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByCategory',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const products = await this.model.findByCategory(category, undefined);

                return products;
            }
        });
    }

    /**
     * Checks if a product is available.
     * @param actor - The user or system performing the action.
     * @param productId - The product ID.
     * @returns ServiceOutput containing boolean indicating availability.
     */
    public async checkIsAvailable(
        actor: Actor,
        productId: string
    ): Promise<ServiceOutput<{ isAvailable: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'checkIsAvailable',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: productId } as Product);

                // Execute check
                const isAvailable = await this.model.isAvailable(productId, undefined);

                return { isAvailable };
            }
        });
    }

    /**
     * Gets available pricing plans for a product.
     * @param actor - The user or system performing the action.
     * @param productId - The product ID.
     * @returns ServiceOutput containing array of pricing plans.
     */
    public async getAvailablePlans(
        actor: Actor,
        productId: string
    ): Promise<ServiceOutput<PricingPlan[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAvailablePlans',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: productId } as Product);

                // Execute query
                const plans = await this.model.getAvailablePlans(productId, undefined);

                return plans;
            }
        });
    }

    /**
     * Calculates pricing for a product with given quantity.
     * @param actor - The user or system performing the action.
     * @param productId - The product ID.
     * @param quantity - The quantity to calculate pricing for.
     * @returns ServiceOutput containing pricing calculation result.
     */
    public async calculatePricing(
        actor: Actor,
        productId: string,
        quantity: number
    ): Promise<
        ServiceOutput<{
            basePrice: number;
            totalPrice: number;
            discount: number;
            quantity: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'calculatePricing',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: productId } as Product);

                // Execute calculation
                const pricing = await this.model.calculatePricing(productId, quantity, undefined);

                return pricing;
            }
        });
    }

    /**
     * Finds products with their pricing plans.
     * @param actor - The user or system performing the action.
     * @returns ServiceOutput containing products with their pricing plans.
     */
    public async findWithPricingPlans(actor: Actor): Promise<ServiceOutput<ProductWithPlans[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findWithPricingPlans',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const products = await this.model.findWithPricingPlans(undefined);

                return products;
            }
        });
    }
}
