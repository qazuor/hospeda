/**
 * Basic Service Example - ProductService
 *
 * This file demonstrates a complete, minimal service implementation
 * with all required methods and permission hooks.
 *
 * Use this as a template for creating new services.
 */

import { ProductModel } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { RoleEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Product } from '@repo/schemas/entities/product';
import {
  ProductCreateInputSchema,
  ProductUpdateInputSchema,
  ProductSearchSchema
} from '@repo/schemas/entities/product';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, PaginatedListOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing products.
 *
 * This is a minimal, clean service implementation showing:
 * - Simple role-based permissions
 * - Basic CRUD operations
 * - No custom business logic
 * - No lifecycle hooks (using defaults)
 *
 * Perfect starting point for new services.
 */
export class ProductService extends BaseCrudService<
  Product,
  ProductModel,
  typeof ProductCreateInputSchema,
  typeof ProductUpdateInputSchema,
  typeof ProductSearchSchema
> {
  /** Entity name for logging */
  static readonly ENTITY_NAME = 'product';
  protected readonly entityName = ProductService.ENTITY_NAME;

  /** Database model instance */
  public readonly model: ProductModel;

  /** Zod validation schemas */
  public readonly createSchema = ProductCreateInputSchema;
  public readonly updateSchema = ProductUpdateInputSchema;
  public readonly searchSchema = ProductSearchSchema;

  /**
   * Initialize service
   *
   * @param ctx - Service context with logger
   * @param model - Optional model instance (for testing)
   */
  constructor(ctx: ServiceContext, model?: ProductModel) {
    super(ctx, ProductService.ENTITY_NAME);
    this.model = model ?? new ProductModel();
  }

  /**
   * Define default relations for list operations
   *
   * Returns empty object = no relations loaded by default
   */
  protected getDefaultListRelations(): ListRelationsConfig {
    return {}; // No relations for this simple service
  }

  // ============================================================================
  // PERMISSION HOOKS
  // ============================================================================

  /**
   * Check create permission
   *
   * Rule: Only ADMIN users can create products
   */
  protected _canCreate(actor: Actor, _data: unknown): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can create products'
      );
    }
  }

  /**
   * Check update permission
   *
   * Rule: Only ADMIN users can update products
   */
  protected _canUpdate(actor: Actor, _entity: Product): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can update products'
      );
    }
  }

  /**
   * Check soft delete permission
   *
   * Rule: Only ADMIN users can delete products
   */
  protected _canSoftDelete(actor: Actor, _entity: Product): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can delete products'
      );
    }
  }

  /**
   * Check hard delete permission
   *
   * Rule: Only SUPER_ADMIN can permanently delete
   */
  protected _canHardDelete(actor: Actor, _entity: Product): void {
    if (actor.role !== RoleEnum.SUPER_ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only super administrators can permanently delete products'
      );
    }
  }

  /**
   * Check restore permission
   *
   * Rule: Only ADMIN can restore
   */
  protected _canRestore(actor: Actor, _entity: Product): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can restore products'
      );
    }
  }

  /**
   * Check view permission
   *
   * Rule: Authenticated users can view products
   */
  protected _canView(actor: Actor, _entity: Product): void {
    if (!actor || !actor.id) {
      throw new ServiceError(
        ServiceErrorCode.UNAUTHORIZED,
        'Authentication required to view products'
      );
    }
  }

  /**
   * Check list permission
   *
   * Rule: Authenticated users can list
   */
  protected _canList(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new ServiceError(
        ServiceErrorCode.UNAUTHORIZED,
        'Authentication required to list products'
      );
    }
  }

  /**
   * Check search permission
   *
   * Rule: Authenticated users can search
   */
  protected _canSearch(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new ServiceError(
        ServiceErrorCode.UNAUTHORIZED,
        'Authentication required to search products'
      );
    }
  }

  /**
   * Check count permission
   *
   * Rule: Authenticated users can count
   */
  protected _canCount(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new ServiceError(
        ServiceErrorCode.UNAUTHORIZED,
        'Authentication required to count products'
      );
    }
  }

  // ============================================================================
  // SEARCH & COUNT IMPLEMENTATION
  // ============================================================================

  /**
   * Execute search query
   *
   * Translates search parameters into database query
   */
  protected async _executeSearch(
    params: Record<string, unknown>,
    _actor: Actor
  ): Promise<PaginatedListOutput<Product>> {
    // Extract pagination
    const { page = 1, pageSize = 20, ...filters } = params;

    // Execute query
    return this.model.findAll(filters, { page, pageSize });
  }

  /**
   * Execute count query
   *
   * Counts entities matching filters
   */
  protected async _executeCount(
    params: Record<string, unknown>,
    _actor: Actor
  ): Promise<{ count: number }> {
    // Remove pagination params (not needed for count)
    const { page, pageSize, ...filters } = params;

    // Execute count
    const count = await this.model.count(filters);
    return { count };
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Create service instance
const productService = new ProductService({ logger: console });

// Create admin actor
const adminActor: Actor = {
  id: 'admin-123',
  role: RoleEnum.ADMIN,
  permissions: []
};

// Create user actor
const userActor: Actor = {
  id: 'user-456',
  role: RoleEnum.USER,
  permissions: []
};

// Example 1: Create product (admin only)
const createResult = await productService.create(adminActor, {
  name: 'Premium Subscription',
  description: 'Our best plan',
  price: 99.99,
  category: 'subscription',
  isActive: true
});

if (createResult.data) {
  console.log('Created:', createResult.data);
}

// Example 2: List products (authenticated users)
const listResult = await productService.list(userActor, {
  page: 1,
  pageSize: 20
});

if (listResult.data) {
  console.log('Found:', listResult.data.items.length, 'products');
}

// Example 3: Search products
const searchResult = await productService.search(userActor, {
  category: 'subscription',
  isActive: true,
  page: 1,
  pageSize: 10
});

// Example 4: Update product (admin only)
const updateResult = await productService.update(
  adminActor,
  createResult.data!.id,
  { price: 89.99 }
);

// Example 5: Delete product (admin only)
const deleteResult = await productService.softDelete(
  adminActor,
  createResult.data!.id
);

if (deleteResult.data?.count === 1) {
  console.log('Product deleted');
}
*/
