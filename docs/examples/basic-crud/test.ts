import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryModel } from './model';
import { CategoryService } from './service';
import type { Actor } from '@repo/service-core/types';
import { ServiceErrorCode } from '@repo/service-core/types';

/**
 * Category Service Test Suite
 *
 * Demonstrates comprehensive testing following Hospeda patterns:
 * - AAA Pattern (Arrange, Act, Assert)
 * - Unit tests for all CRUD operations
 * - Permission testing
 * - Validation testing
 * - Error handling testing
 */

/**
 * Test Utilities and Mocks
 */

// Mock logger
const createLoggerMock = () => ({
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
});

// Mock model
const createModelMock = () => {
  const mock = {
    findById: vi.fn(),
    findOne: vi.fn(),
    findAll: vi.fn(),
    findBySlug: vi.fn(),
    findAllActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateSortOrder: vi.fn(),
    softDelete: vi.fn(),
    hardDelete: vi.fn(),
    restore: vi.fn(),
    count: vi.fn(),
    countActive: vi.fn()
  };
  return mock as unknown as CategoryModel;
};

// Create actor helper
const createActor = (permissions: string[] = []): Actor => ({
  id: 'test-user-id',
  role: 'user',
  permissions
});

// Test data factories
const createCategoryData = (overrides = {}) => ({
  id: 'category-id-123',
  name: 'Test Category',
  slug: 'test-category',
  description: 'A test category description',
  icon: '📁',
  isActive: true,
  sortOrder: 0,
  lifecycleState: 'ACTIVE' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: 'user-id',
  updatedById: 'user-id',
  ...overrides
});

/**
 * Test Suite: CategoryService.create
 */
describe('CategoryService.create', () => {
  let service: CategoryService;
  let modelMock: CategoryModel;
  let actor: Actor;

  beforeEach(() => {
    modelMock = createModelMock();
    service = new CategoryService({ logger: createLoggerMock() }, modelMock);
    actor = createActor(['CATEGORY_CREATE']);
  });

  it('should create a category successfully', async () => {
    // Arrange
    const input = {
      name: 'Outdoor Activities',
      slug: 'outdoor-activities',
      description: 'Activities for outdoor enthusiasts',
      icon: '🏕️',
      isActive: true,
      lifecycleState: 'ACTIVE' as const,
      sortOrder: 0
    };
    const expected = createCategoryData(input);

    modelMock.findOne = vi.fn().mockResolvedValue(null); // No duplicate
    modelMock.create = vi.fn().mockResolvedValue(expected);

    // Act
    const result = await service.create(actor, input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe(input.name);
      expect(result.data.slug).toBe(input.slug);
    }
    expect(modelMock.create).toHaveBeenCalledOnce();
  });

  it('should return FORBIDDEN if actor lacks CATEGORY_CREATE permission', async () => {
    // Arrange
    actor = createActor([]); // No permissions
    const input = {
      name: 'Test',
      slug: 'test',
      lifecycleState: 'ACTIVE' as const,
      sortOrder: 0,
      isActive: true
    };

    // Act
    const result = await service.create(actor, input);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
    }
  });

  it('should return VALIDATION_ERROR for invalid input', async () => {
    // Arrange
    const invalidInput = {
      name: '', // Too short
      slug: 'test',
      lifecycleState: 'ACTIVE' as const,
      sortOrder: 0,
      isActive: true
    };

    // Act
    const result = await service.create(actor, invalidInput);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    }
  });

  it('should reject duplicate slugs', async () => {
    // Arrange
    const input = {
      name: 'Test Category',
      slug: 'test-category',
      lifecycleState: 'ACTIVE' as const,
      sortOrder: 0,
      isActive: true
    };
    const existing = createCategoryData({ slug: 'test-category' });

    modelMock.findOne = vi.fn().mockResolvedValue(existing);

    // Act
    const result = await service.create(actor, input);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
      expect(result.error.message).toContain('slug');
    }
  });
});

/**
 * Test Suite: CategoryService.update
 */
describe('CategoryService.update', () => {
  let service: CategoryService;
  let modelMock: CategoryModel;
  let actor: Actor;

  beforeEach(() => {
    modelMock = createModelMock();
    service = new CategoryService({ logger: createLoggerMock() }, modelMock);
    actor = createActor(['CATEGORY_UPDATE']);
  });

  it('should update a category successfully', async () => {
    // Arrange
    const categoryId = 'category-id-123';
    const existing = createCategoryData({ id: categoryId });
    const updateData = { name: 'Updated Name' };
    const updated = { ...existing, ...updateData };

    modelMock.findById = vi.fn().mockResolvedValue(existing);
    modelMock.update = vi.fn().mockResolvedValue(updated);

    // Act
    const result = await service.update(actor, { id: categoryId, data: updateData });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Updated Name');
    }
  });

  it('should return NOT_FOUND for non-existent category', async () => {
    // Arrange
    modelMock.findById = vi.fn().mockResolvedValue(null);

    // Act
    const result = await service.update(actor, {
      id: 'non-existent-id',
      data: { name: 'New Name' }
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
    }
  });

  it('should return FORBIDDEN without permission', async () => {
    // Arrange
    actor = createActor([]); // No permissions
    const existing = createCategoryData();
    modelMock.findById = vi.fn().mockResolvedValue(existing);

    // Act
    const result = await service.update(actor, {
      id: existing.id,
      data: { name: 'New Name' }
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
    }
  });
});

/**
 * Test Suite: CategoryService.search
 */
describe('CategoryService.search', () => {
  let service: CategoryService;
  let modelMock: CategoryModel;
  let actor: Actor;

  beforeEach(() => {
    modelMock = createModelMock();
    service = new CategoryService({ logger: createLoggerMock() }, modelMock);
    actor = createActor([]);
  });

  it('should search categories with filters', async () => {
    // Arrange
    const categories = [
      createCategoryData({ name: 'Category 1' }),
      createCategoryData({ name: 'Category 2' })
    ];

    modelMock.findAll = vi.fn().mockResolvedValue({
      items: categories,
      total: 2
    });

    // Act
    const result = await service.search(actor, {
      isActive: true,
      page: 1,
      pageSize: 10
    });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.total).toBe(2);
    }
  });

  it('should filter out inactive categories for non-admins', async () => {
    // Arrange
    const categories = [createCategoryData({ isActive: true })];

    modelMock.findAll = vi.fn().mockResolvedValue({
      items: categories,
      total: 1
    });

    // Act
    const result = await service.search(actor, { page: 1, pageSize: 10 });

    // Assert
    expect(modelMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
      expect.anything()
    );
  });

  it('should show all categories for admins', async () => {
    // Arrange
    actor = createActor(['CATEGORY_VIEW_ALL']);
    const categories = [
      createCategoryData({ isActive: true }),
      createCategoryData({ isActive: false })
    ];

    modelMock.findAll = vi.fn().mockResolvedValue({
      items: categories,
      total: 2
    });

    // Act
    const result = await service.search(actor, { page: 1, pageSize: 10 });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
    }
  });
});

/**
 * Test Suite: CategoryService.getBySlug
 */
describe('CategoryService.getBySlug', () => {
  let service: CategoryService;
  let modelMock: CategoryModel;
  let actor: Actor;

  beforeEach(() => {
    modelMock = createModelMock();
    service = new CategoryService({ logger: createLoggerMock() }, modelMock);
    actor = createActor([]);
  });

  it('should get category by slug', async () => {
    // Arrange
    const category = createCategoryData({ slug: 'outdoor-activities' });
    modelMock.findBySlug = vi.fn().mockResolvedValue(category);

    // Act
    const result = await service.getBySlug(actor, { slug: 'outdoor-activities' });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('outdoor-activities');
    }
  });

  it('should return NOT_FOUND for non-existent slug', async () => {
    // Arrange
    modelMock.findBySlug = vi.fn().mockResolvedValue(null);

    // Act
    const result = await service.getBySlug(actor, { slug: 'non-existent' });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
    }
  });

  it('should return FORBIDDEN for inactive category without permission', async () => {
    // Arrange
    const category = createCategoryData({ isActive: false });
    modelMock.findBySlug = vi.fn().mockResolvedValue(category);

    // Act
    const result = await service.getBySlug(actor, { slug: category.slug });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
    }
  });
});

/**
 * Test Suite: CategoryService.delete
 */
describe('CategoryService.delete', () => {
  let service: CategoryService;
  let modelMock: CategoryModel;
  let actor: Actor;

  beforeEach(() => {
    modelMock = createModelMock();
    service = new CategoryService({ logger: createLoggerMock() }, modelMock);
    actor = createActor(['CATEGORY_DELETE']);
  });

  it('should soft delete category', async () => {
    // Arrange
    const category = createCategoryData();
    modelMock.findById = vi.fn().mockResolvedValue(category);
    modelMock.softDelete = vi.fn().mockResolvedValue(1);

    // Act
    const result = await service.softDelete(actor, { id: category.id });

    // Assert
    expect(result.success).toBe(true);
    expect(modelMock.softDelete).toHaveBeenCalled();
  });

  it('should return FORBIDDEN without permission', async () => {
    // Arrange
    actor = createActor([]);
    const category = createCategoryData();
    modelMock.findById = vi.fn().mockResolvedValue(category);

    // Act
    const result = await service.softDelete(actor, { id: category.id });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
    }
  });
});
