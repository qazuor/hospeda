import type { Tag } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { tags } from '../../schemas/tag/tag.dbschema.ts';

export class TagModel extends BaseModelImpl<Tag> {
    protected table = tags;
    protected entityName = 'tags';

    protected getTableName(): string {
        return 'tags';
    }
}
