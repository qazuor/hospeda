import { CategoryModel } from './model';
import type { Category } from './schema';
import {
  CategoryCreateInputSchema,
  CategoryUpdateInputSchema,
  CategorySearchInputSchema,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type CategorySearchInput
} from './schema';
import { BaseCrudService } from '@repo/service-core/base';
import type { Actor, ServiceContext, ServiceOutput } from '@repo/service-core/types';
import { ServiceError, ServiceErrorCode } from '@repo/service-core/types';

/**
 * Category Service
 *
 * Implements business logic for Category entity.
 * Extends BaseCrudService to inherit standard CRUD operations.
 *
 * @example
 * ```typescript
 * const service = new CategoryService({ logger });
 *
 * // Create category
 * const result = await service.create(actor, {
 *   name: 'Outdoor Activities',
 *   slug: 'outdoor-activities',
 *   lifecycleState: 'ACTIVE'
 * });
 *
 * if (result.success) {
 *   console.log('Created:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export class CategoryService extends BaseCrudService<
  Category,
  CategoryModel,
  typeof CategoryCreateInputSchema,
  typeof CategoryUpdateInputSchema,
  typeof CategorySearchInputSchema
> {
  /**
   * The entity name (used for logging and errors)
   */
  static readonly ENTITY_NAME = 'category';
  protected readonly entityName = CategoryService.ENTITY_NAME;

  /**
   * The database model
   */
  protected readonly model: CategoryModel;

  /**
   * Zod schemas for validation
   */
  protected readonly createSchema = CategoryCreateInputSchema;
  protected readonly updateSchema = CategoryUpdateInputSchema;
  protected readonly searchSchema = CategorySearchInputSchema;

  /**
   * Initialize the CategoryService
   *
   * @param ctx - Service context containing logger and actor info
   * @param model - Optional CategoryModel instance (for testing/mocking)
   */
  constructor(ctx: ServiceContext, model?: CategoryModel) {
    super(ctx, CategoryService.ENTITY_NAME);
    this.model = model ?? new CategoryModel();
  }

  /**
   * Authorization: Check if actor can create categories
   *
   * @param actor - The actor attempting the action
   * @param _data - The data being created (not used for create permission)
   */
  protected _canCreate(actor: Actor, _data: CategoryCreateInput): void {
    // Only admins can create categories
    if (!actor.permissions?.includes('CATEGORY_CREATE')) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'You do not have permission to create categories'
      );
    }
  }

  /**
   * Authorization: Check if actor can update a category
   *
   * @param actor - The actor attempting the action
   * @param entity - The category being updated
   */
  protected _canUpdate(actor: Actor, entity: Category): void {
    // Only admins can update categories
    if (!actor.permissions?.includes('CATEGORY_UPDATE')) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'You do not have permission to update categories'
      );
    }
  }

  /**
   * Authorization: Check if actor can delete a category
   *
   * @param actor - The actor attempting the action
   * @param entity - The category being deleted
   */
  protected _canDelete(actor: Actor, entity: Category): void {
    // Only admins can delete categories
    if (!actor.permissions?.includes('CATEGORY_DELETE')) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'You do not have permission to delete categories'
      );
    }
  }

  /**
   * Authorization: Check if actor can view a category
   *
   * @param actor - The actor attempting the action
   * @param entity - The category being viewed
   */
  protected _canView(actor: Actor, entity: Category): void {
    // Everyone can view active categories
    if (entity.isActive) {
      return;
    }

    // Only admins can view inactive categories
    if (!actor.permissions?.includes('CATEGORY_VIEW_ALL')) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'You do not have permission to view this category'
      );
    }
  }

  /**
   * Authorization: Check if actor can list categories
   *
   * @param actor - The actor attempting the action
   */
  protected _canList(actor: Actor): void {
    // Everyone can list categories (filtering happens in _executeSearch)
  }

  /**
   * Authorization: Check if actor can search categories
   *
   * @param actor - The actor attempting the action
   */
  protected _canSearch(actor: Actor): void {
    // Everyone can search categories
  }

  /**
   * Execute the database search for categories
   *
   * @param params - Validated search parameters
   * @param actor - The actor performing the search
   * @returns Promise with paginated category results
   */
  protected async _executeSearch(
    params: CategorySearchInput,
    actor: Actor
  ): Promise<{ items: Category[]; total: number }> {
    const { page = 1, pageSize = 20, ...filters } = params;

    // Non-admins can only see active categories
    if (!actor.permissions?.includes('CATEGORY_VIEW_ALL')) {
      filters.isActive = true;
    }

    return this.model.findAll(filters, { page, pageSize });
  }

  /**
   * Execute the database count for categories
   *
   * @param params - Validated search parameters
   * @param actor - The actor performing the count
   * @returns Promise with count result
   */
  protected async _executeCount(
    params: CategorySearchInput,
    actor: Actor
  ): Promise<{ count: number }> {
    const { ...filters } = params;

    // Non-admins can only count active categories
    if (!actor.permissions?.includes('CATEGORY_VIEW_ALL')) {
      filters.isActive = true;
    }

    const count = await this.model.count(filters);
    return { count };
  }

  /**
   * Business Logic: Get category by slug
   *
   * @param actor - The actor performing the action
   * @param input - Object containing slug
   * @returns ServiceOutput with category or error
   *
   * @example
   * ```typescript
   * const result = await service.getBySlug(actor, { slug: 'outdoor-activities' });
   * if (result.success) {
   *   console.log(result.data);
   * }
   * ```
   */
  async getBySlug(
    actor: Actor,
    input: { slug: string }
  ): Promise<ServiceOutput<Category>> {
    return this.runWithLoggingAndValidation({
      methodName: 'getBySlug',
      input: { actor, ...input },
      schema: z.object({ slug: z.string().min(1) }),
      execute: async (validated) => {
        const category = await this.model.findBySlug(validated.slug);

        if (!category) {
          throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Category with slug '${validated.slug}' not found`
          );
        }

        // Check view permission
        this._canView(actor, category);

        return category;
      }
    });
  }

  /**
   * Business Logic: Update category sort order
   *
   * @param actor - The actor performing the action
   * @param input - Object containing id and sortOrder
   * @returns ServiceOutput with updated category or error
   *
   * @example
   * ```typescript
   * const result = await service.updateSortOrder(actor, {
   *   id: 'category-id',
   *   sortOrder: 5
   * });
   * ```
   */
  async updateSortOrder(
    actor: Actor,
    input: { id: string; sortOrder: number }
  ): Promise<ServiceOutput<Category>> {
    return this.runWithLoggingAndValidation({
      methodName: 'updateSortOrder',
      input: { actor, ...input },
      schema: z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int().min(0)
      }),
      execute: async (validated) => {
        // Fetch existing category
        const category = await this.model.findById(validated.id);

        if (!category) {
          throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Category with id '${validated.id}' not found`
          );
        }

        // Check update permission
        this._canUpdate(actor, category);

        // Update sort order
        const updated = await this.model.updateSortOrder(
          validated.id,
          validated.sortOrder
        );

        if (!updated) {
          throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Failed to update category sort order'
          );
        }

        return updated;
      }
    });
  }

  /**
   * Business Logic: Get all active categories
   *
   * @param actor - The actor performing the action
   * @returns ServiceOutput with array of active categories
   *
   * @example
   * ```typescript
   * const result = await service.getAllActive(actor);
   * if (result.success) {
   *   console.log(`Found ${result.data.length} active categories`);
   * }
   * ```
   */
  async getAllActive(actor: Actor): Promise<ServiceOutput<Category[]>> {
    return this.runWithLoggingAndValidation({
      methodName: 'getAllActive',
      input: { actor },
      schema: z.object({}),
      execute: async () => {
        // Check list permission
        this._canList(actor);

        // Get all active categories
        const categories = await this.model.findAllActive();

        return categories;
      }
    });
  }

  /**
   * Business Logic: Deactivate category
   *
   * @param actor - The actor performing the action
   * @param input - Object containing id
   * @returns ServiceOutput with updated category
   *
   * @example
   * ```typescript
   * const result = await service.deactivate(actor, { id: 'category-id' });
   * ```
   */
  async deactivate(
    actor: Actor,
    input: { id: string }
  ): Promise<ServiceOutput<Category>> {
    return this.runWithLoggingAndValidation({
      methodName: 'deactivate',
      input: { actor, ...input },
      schema: z.object({ id: z.string().uuid() }),
      execute: async (validated) => {
        // Fetch existing category
        const category = await this.model.findById(validated.id);

        if (!category) {
          throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Category with id '${validated.id}' not found`
          );
        }

        // Check update permission
        this._canUpdate(actor, category);

        // Business rule: Cannot deactivate if already inactive
        if (!category.isActive) {
          throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Category is already inactive'
          );
        }

        // Update to inactive
        const updated = await this.model.update({ id: validated.id }, { isActive: false });

        if (!updated) {
          throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Failed to deactivate category'
          );
        }

        return updated;
      }
    });
  }
}
