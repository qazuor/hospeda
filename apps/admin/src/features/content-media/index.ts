/**
 * Relational media management for editorial content (posts and events) in the
 * admin panel — HOS-390.
 *
 * Entity-agnostic port of `features/commerce` (HOS-382): `post_media` and
 * `event_media` share a row shape, so one hook file and one manager component
 * serve both, parameterized by the `entity` discriminator.
 */

export type { ContentGalleryManagerProps } from './components/ContentGalleryManager';
export { ContentGalleryManager } from './components/ContentGalleryManager';
export type {
    ContentMedia,
    ContentMediaAddPayload,
    ContentMediaEntity
} from './hooks/useContentMedia';
export {
    contentMediaQueryKeys,
    useContentMediaAdd,
    useContentMediaList,
    useContentMediaRemove,
    useContentMediaSetFeatured
} from './hooks/useContentMedia';
