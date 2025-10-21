import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BaseCrudRelatedService } from '../../../src/base/base.crud.related.service';
import type { BaseModel, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';

const ctx: ServiceContext = { logger: createLoggerMock() };
const DummySchema = z.object({ foo: z.string() });
type DummyEntity = { id: string };

class RelatedModelMock {}

class TestRelatedService extends BaseCrudRelatedService<
    DummyEntity,
    BaseModel<DummyEntity>,
    RelatedModelMock,
    typeof DummySchema,
    typeof DummySchema,
    typeof DummySchema
> {
    protected model!: BaseModel<DummyEntity>;
    protected createSchema = DummySchema;
    protected updateSchema = DummySchema;
    protected searchSchema = DummySchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    protected _canCreate() {}
    protected _canUpdate() {}
    protected _canSoftDelete() {}
    protected _canHardDelete() {}
    protected _canRestore() {}
    protected _canView() {}
    protected _canList() {}
    protected _canSearch() {}
    protected _canCount() {}
    protected _canUpdateVisibility() {}
    protected _executeSearch() {
        return Promise.resolve({ items: [], total: 0 });
    }
    protected _executeCount() {
        return Promise.resolve({ count: 0 });
    }
    protected createDefaultRelatedModel(): RelatedModelMock {
        return new RelatedModelMock();
    }
    public getRelatedModel() {
        return this.relatedModel;
    }
}

describe('BaseCrudRelatedService', () => {
    let service: TestRelatedService;
    beforeEach(() => {
        service = new TestRelatedService(ctx, 'TestEntity');
    });
    it('should initialize relatedModel via createDefaultRelatedModel if not provided', () => {
        expect(service.getRelatedModel()).toBeInstanceOf(RelatedModelMock);
    });
    it('should use provided relatedModel if given', () => {
        const customRelated = new RelatedModelMock();
        const customService = new TestRelatedService(ctx, 'TestEntity', customRelated);
        expect(customService.getRelatedModel()).toBe(customRelated);
    });
    it('should allow extending and overriding related methods', async () => {
        class CustomService extends TestRelatedService {
            customMethod() {
                return 'ok';
            }

            protected getDefaultListRelations() {
                return undefined;
            }
        }
        const custom = new CustomService(ctx, 'TestEntity');
        expect(custom.customMethod()).toBe('ok');
    });
});
