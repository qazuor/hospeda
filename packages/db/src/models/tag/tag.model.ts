import type { Tag } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { tags } from '../../schemas/tag/tag.dbschema';

export class TagModel extends BaseModel<Tag> {
    protected table = tags;
    protected entityName = 'tags';

    protected getTableName(): string {
        return 'tags';
    }
}
