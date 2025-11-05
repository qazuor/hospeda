# Testing Services - Comprehensive Guide

Complete guide to testing services in Hospeda.

## Overview

Every service must have 90%+ test coverage. This guide shows how to write comprehensive tests for services.

## Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArticleService } from '../../../src/services/article';
import { ArticleModel } from '@repo/db';
import { RoleEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../../src/types';

describe('ArticleService', () => {
  let service: ArticleService;
  let mockModel: ArticleModel;

  // Test actors
  const adminActor: Actor = {
    id: 'admin-1',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ARTICLE_CREATE, PermissionEnum.ARTICLE_UPDATE_ANY]
  };

  const userActor: Actor = {
    id: 'user-1',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ARTICLE_CREATE]
  };

  const guestActor: Actor = {
    id: '',
    role: RoleEnum.GUEST,
    permissions: []
  };

  beforeEach(() => {
    mockModel = new ArticleModel();
    service = new ArticleService({ logger: console }, mockModel);
  });

  describe('create', () => {
    it('should create article successfully', async () => {
      const data = {
        title: 'Test Article',
        content: 'This is test content with sufficient length',
        categoryId: 'cat-123'
      };

      const result = await service.create(userActor, data);

      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Test Article');
    });

    it('should reject invalid data', async () => {
      const data = { title: '', content: 'x', categoryId: 'invalid' };

      const result = await service.create(userActor, data as any);

      expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should deny guest users', async () => {
      const data = { title: 'Test', content: 'Content', categoryId: 'cat-1' };

      const result = await service.create(guestActor, data);

      expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });
  });

  // More tests...
});
```

## Testing CRUD Operations

### Create Tests

```typescript
describe('create', () => {
  it('should create with valid data', async () => {
    const result = await service.create(userActor, validData);
    expect(result.data).toBeDefined();
  });

  it('should validate required fields', async () => {
    const result = await service.create(userActor, {} as any);
    expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
  });

  it('should enforce permissions', async () => {
    const result = await service.create(guestActor, validData);
    expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
  });

  it('should call beforeCreate hook', async () => {
    const spy = vi.spyOn(service as any, '_beforeCreate');
    await service.create(userActor, validData);
    expect(spy).toHaveBeenCalled();
  });

  it('should call afterCreate hook', async () => {
    const spy = vi.spyOn(service as any, '_afterCreate');
    await service.create(userActor, validData);
    expect(spy).toHaveBeenCalled();
  });
});
```

### Read Tests

```typescript
describe('getById', () => {
  it('should fetch existing entity', async () => {
    const created = await service.create(userActor, validData);
    const result = await service.getById(userActor, created.data!.id);

    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe(created.data!.id);
  });

  it('should return NOT_FOUND for non-existent', async () => {
    const result = await service.getById(userActor, 'non-existent-id');
    expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
  });

  it('should respect visibility permissions', async () => {
    const draft = await service.create(userActor, { ...validData, status: 'draft' });
    const result = await service.getById(guestActor, draft.data!.id);

    expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
  });
});

describe('list', () => {
  it('should list with pagination', async () => {
    // Create multiple articles
    await Promise.all([
      service.create(userActor, validData),
      service.create(userActor, validData),
      service.create(userActor, validData)
    ]);

    const result = await service.list(userActor, { page: 1, pageSize: 2 });

    expect(result.data).toBeDefined();
    expect(result.data?.items).toHaveLength(2);
    expect(result.data?.total).toBeGreaterThanOrEqual(3);
  });

  it('should filter by actor in beforeList hook', async () => {
    // Test implementation...
  });
});
```

### Update Tests

```typescript
describe('update', () => {
  it('should update own entity', async () => {
    const created = await service.create(userActor, validData);
    const result = await service.update(userActor, created.data!.id, {
      title: 'Updated Title'
    });

    expect(result.data?.title).toBe('Updated Title');
  });

  it('should prevent updating others entities', async () => {
    const created = await service.create(userActor, validData);
    const otherActor = { ...userActor, id: 'other-user' };

    const result = await service.update(otherActor, created.data!.id, {
      title: 'Updated'
    });

    expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
  });

  it('should allow admin to update any', async () => {
    const created = await service.create(userActor, validData);
    const result = await service.update(adminActor, created.data!.id, {
      title: 'Admin Update'
    });

    expect(result.data?.title).toBe('Admin Update');
  });
});
```

### Delete Tests

```typescript
describe('softDelete', () => {
  it('should soft delete entity', async () => {
    const created = await service.create(userActor, validData);
    const result = await service.softDelete(userActor, created.data!.id);

    expect(result.data?.count).toBe(1);

    // Verify entity is deleted
    const getResult = await service.getById(userActor, created.data!.id);
    expect(getResult.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
  });

  it('should prevent deleting others entities', async () => {
    const created = await service.create(userActor, validData);
    const otherActor = { ...userActor, id: 'other-user' };

    const result = await service.softDelete(otherActor, created.data!.id);

    expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
  });
});

describe('restore', () => {
  it('should restore soft-deleted entity', async () => {
    const created = await service.create(userActor, validData);
    await service.softDelete(userActor, created.data!.id);

    const result = await service.restore(adminActor, created.data!.id);

    expect(result.data?.count).toBe(1);
  });
});
```

## Testing Permission Hooks

```typescript
describe('Permission Hooks', () => {
  describe('_canCreate', () => {
    it('should allow users with permission', async () => {
      const result = await service.create(userActor, validData);
      expect(result.data).toBeDefined();
    });

    it('should deny guests', async () => {
      const result = await service.create(guestActor, validData);
      expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });
  });

  describe('_canUpdate', () => {
    it('should allow owner', async () => {
      const created = await service.create(userActor, validData);
      const result = await service.update(userActor, created.data!.id, { title: 'New' });
      expect(result.data).toBeDefined();
    });

    it('should allow admin', async () => {
      const created = await service.create(userActor, validData);
      const result = await service.update(adminActor, created.data!.id, { title: 'New' });
      expect(result.data).toBeDefined();
    });

    it('should deny other users', async () => {
      const created = await service.create(userActor, validData);
      const otherUser = { ...userActor, id: 'other' };
      const result = await service.update(otherUser, created.data!.id, { title: 'New' });
      expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
  });

  describe('_canView', () => {
    it('should allow viewing published articles', async () => {
      const article = await createPublishedArticle();
      const result = await service.getById(guestActor, article.id);
      expect(result.data).toBeDefined();
    });

    it('should deny viewing drafts for guests', async () => {
      const draft = await service.create(userActor, { ...validData, status: 'draft' });
      const result = await service.getById(guestActor, draft.data!.id);
      expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });

    it('should allow owner to view own drafts', async () => {
      const draft = await service.create(userActor, { ...validData, status: 'draft' });
      const result = await service.getById(userActor, draft.data!.id);
      expect(result.data).toBeDefined();
    });
  });
});
```

## Testing Lifecycle Hooks

```typescript
describe('Lifecycle Hooks', () => {
  describe('_beforeCreate', () => {
    it('should generate slug from title', async () => {
      const data = { ...validData, title: 'Hello World' };
      const result = await service.create(userActor, data);

      expect(result.data?.slug).toBe('hello-world');
    });

    it('should ensure slug uniqueness', async () => {
      await service.create(userActor, { ...validData, title: 'Duplicate' });
      const result = await service.create(userActor, { ...validData, title: 'Duplicate' });

      expect(result.data?.slug).toBe('duplicate-1');
    });
  });

  describe('_afterCreate', () => {
    it('should send notification', async () => {
      const spy = vi.spyOn(notificationService, 'send');
      await service.create(userActor, validData);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'article.created' })
      );
    });

    it('should index for search', async () => {
      const spy = vi.spyOn(searchService, 'indexArticle');
      await service.create(userActor, validData);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('_afterUpdate', () => {
    it('should invalidate cache', async () => {
      const spy = vi.spyOn(cacheService, 'delete');
      const article = await service.create(userActor, validData);
      await service.update(userActor, article.data!.id, { title: 'New' });

      expect(spy).toHaveBeenCalledWith(`article:${article.data!.id}`);
    });
  });
});
```

## Testing Custom Methods

```typescript
describe('Custom Methods', () => {
  describe('publish', () => {
    it('should publish draft article', async () => {
      const draft = await service.create(userActor, { ...validData, status: 'draft' });
      const result = await service.publish(userActor, draft.data!.id);

      expect(result.data?.status).toBe('published');
      expect(result.data?.publishedAt).toBeDefined();
    });

    it('should reject publishing non-draft', async () => {
      const published = await createPublishedArticle();
      const result = await service.publish(userActor, published.id);

      expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should validate content length', async () => {
      const draft = await service.create(userActor, {
        ...validData,
        content: 'Too short',
        status: 'draft'
      });
      const result = await service.publish(userActor, draft.data!.id);

      expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toContain('100 characters');
    });
  });

  describe('calculateStats', () => {
    it('should calculate article statistics', async () => {
      const article = await createPublishedArticle();
      const result = await service.calculateStats(userActor, article.id);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveProperty('viewCount');
      expect(result.data).toHaveProperty('averageRating');
      expect(result.data).toHaveProperty('commentCount');
    });
  });

  describe('bulkPublish', () => {
    it('should publish multiple articles', async () => {
      const draft1 = await service.create(userActor, { ...validData, status: 'draft' });
      const draft2 = await service.create(userActor, { ...validData, status: 'draft' });

      const result = await service.bulkPublish(userActor, [
        draft1.data!.id,
        draft2.data!.id
      ]);

      expect(result.data?.success).toBe(2);
      expect(result.data?.failed).toBe(0);
    });

    it('should handle partial failures', async () => {
      const draft = await service.create(userActor, { ...validData, status: 'draft' });
      const published = await createPublishedArticle();

      const result = await service.bulkPublish(userActor, [
        draft.data!.id,
        published.id  // Will fail
      ]);

      expect(result.data?.success).toBe(1);
      expect(result.data?.failed).toBe(1);
    });
  });
});
```

## Testing Error Cases

```typescript
describe('Error Handling', () => {
  it('should handle validation errors', async () => {
    const result = await service.create(userActor, { invalid: 'data' } as any);

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
  });

  it('should handle not found errors', async () => {
    const result = await service.getById(userActor, 'non-existent');

    expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
  });

  it('should handle permission errors', async () => {
    const result = await service.create(guestActor, validData);

    expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
  });

  it('should handle database errors gracefully', async () => {
    vi.spyOn(mockModel, 'create').mockRejectedValue(new Error('DB Error'));

    const result = await service.create(userActor, validData);

    expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
  });
});
```

## Test Helpers

```typescript
// Test data builders
function createTestArticle(overrides?: Partial<ArticleCreateInput>) {
  return {
    title: 'Test Article',
    content: 'This is test content with sufficient length for validation',
    categoryId: 'cat-123',
    ...overrides
  };
}

function createTestActor(role: RoleEnum = RoleEnum.USER): Actor {
  return {
    id: `user-${Math.random()}`,
    role,
    permissions: []
  };
}

// Async helpers
async function createPublishedArticle() {
  const article = await service.create(userActor, {
    ...validData,
    status: 'draft'
  });

  await service.publish(userActor, article.data!.id);

  return article.data!;
}
```

## Coverage Requirements

- Minimum 90% coverage for all services
- 100% coverage for permission hooks
- All error paths tested
- All custom methods tested

Run coverage:
```bash
pnpm test:coverage
```

---

**See Also:**
- [Examples](../examples/) - Working test examples
- [Testing Standards](../../../../.claude/docs/standards/testing-standards.md)
