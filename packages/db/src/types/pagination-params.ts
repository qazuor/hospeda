import type { TagOrderByColumn } from '../models/tag/tag.model';

export type PaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: TagOrderByColumn;
};

export type SearchParams = PaginationParams & {
    q?: string;
    name?: string;
};
