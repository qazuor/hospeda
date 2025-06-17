import type { TagType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { tags } from '../../schemas/tag/tag.dbschema';

export class TagModel extends BaseModel<TagType> {
    protected table = tags;
    protected entityName = 'tags';
}
