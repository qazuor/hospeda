/**
 * @file use-get-social-post.ts
 * @description Thin re-export hook for fetching a single social post detail (SPEC-254 T-040).
 *
 * Delegates to {@link useSocialPostDetail} from the canonical `use-social-posts` module.
 * Exists as a dedicated file so the detail route can import it by a stable, discoverable name
 * that mirrors the admin hook naming convention (useGet<Entity>).
 *
 * Gate: caller must have SOCIAL_POST_VIEW (enforced server-side).
 */

export { useSocialPostDetail as useGetSocialPost } from './use-social-posts';
