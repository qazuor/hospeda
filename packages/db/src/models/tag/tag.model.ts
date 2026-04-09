import type { Tag } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { tags } from '../../schemas/tag/tag.dbschema.ts';

export class TagModel extends BaseModelImpl<Tag> {
    protected table = tags;
    public entityName = 'tags';

    protected getTableName(): string {
        return 'tags';
    }
}

/** Singleton instance of TagModel for use across the application. */
export const tagModel = new TagModel();
