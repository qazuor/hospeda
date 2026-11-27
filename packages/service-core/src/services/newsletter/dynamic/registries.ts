import {
    NewsletterDynamicEntityTypeEnum as Entity,
    NewsletterDynamicSourceEnum as Source
} from '@repo/schemas';
import type { CardLoader } from './accommodation-card.loader.js';
import { loadAccommodationCards } from './accommodation-card.loader.js';
import { mostViewedSource } from './sources/most-viewed.source.js';
import { newestSource } from './sources/newest.source.js';
import type { SourceResolver } from './sources/source.types.js';
import { topRatedSource } from './sources/top-rated.source.js';

/** Explicit support matrix; disabled entity types deliberately have no sources. */
export const SOURCE_RESOLVERS: Record<Entity, Partial<Record<Source, SourceResolver>>> = {
    [Entity.ACCOMMODATION]: {
        [Source.NEWEST]: newestSource,
        [Source.MOST_VIEWED]: mostViewedSource,
        [Source.TOP_RATED]: topRatedSource
    },
    [Entity.VENUE]: {},
    [Entity.POST]: {},
    [Entity.EVENT]: {},
    [Entity.EXPERIENCE]: {},
    [Entity.PARTNER]: {}
};

/** Explicit card decision for every declared newsletter entity type. */
export const CARD_LOADERS: Record<Entity, CardLoader | null> = {
    [Entity.ACCOMMODATION]: loadAccommodationCards,
    [Entity.VENUE]: null,
    [Entity.POST]: null,
    [Entity.EVENT]: null,
    [Entity.EXPERIENCE]: null,
    [Entity.PARTNER]: null
};
