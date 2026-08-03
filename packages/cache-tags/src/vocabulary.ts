/**
 * @file vocabulary.ts
 * @description The Cloudflare cache-tag vocabulary, shared verbatim by the two
 * sides that must agree on it:
 *
 *   - the EMITTER — `apps/web` middleware, which puts a `Cache-Tag` response
 *     header on every edge-cacheable response;
 *   - the PURGER — `@repo/service-core`'s revalidation adapter, which asks
 *     Cloudflare to invalidate `{ tags: [...] }` when content is written.
 *
 * A tag that one side spells differently from the other is a purge that reports
 * success and evicts nothing — a silent staleness bug. That is the entire reason
 * this package exists as a single dependency-free module instead of two parallel
 * tables (HOS-369 §5.11.1 / D-6: the 466-line `entity-path-mapper.ts` it replaces
 * was exactly such a hand-maintained duplicate, and it had already drifted).
 *
 * Cloudflare's own constraints are encoded here rather than assumed, because
 * every one of them fails silently when violated — an invalid tag is dropped at
 * storage time and the response is still cached, just unpurgeable:
 *
 *   - tags must be printable ASCII (0x21–0x7E): no spaces, no Unicode;
 *   - the comma is the list separator, so a tag may never contain one;
 *   - each tag is at most 1024 characters;
 *   - a response may carry at most 1000 tags;
 *   - the aggregate header may not exceed 16 KB;
 *   - purge-time matching is CASE-INSENSITIVE.
 *
 * The case-insensitivity is why {@link normalizeCacheTagKey} lowercases: if the
 * emitter and the purger disagree on case Cloudflare would still match them, but
 * our own tests, logs and dedup sets would not. Normalizing once, here, keeps
 * every layer consistent with the one that actually matters.
 */

/**
 * Entity kinds that get a per-entity cache tag, mapped to their tag prefix.
 * The prefixes are deliberately short: they are repeated once per tagged
 * response and count against the 16 KB header budget.
 */
export const CACHE_TAG_ENTITY_PREFIXES = {
    accommodation: 'accom',
    destination: 'dest',
    event: 'event',
    post: 'post'
} as const;

/** An entity kind that can be addressed by a per-entity cache tag. */
export type CacheTagEntity = keyof typeof CACHE_TAG_ENTITY_PREFIXES;

/**
 * Collection tags — carried by any response that renders a LIST of that entity
 * kind (listings, facet landings, sitemaps, feeds), so a single write to any
 * member invalidates every page that could have shown it without having to know
 * which pages those are.
 *
 * Keyed by the same {@link CacheTagEntity} union as the per-entity prefixes so
 * the two tables cannot drift apart: adding an entity kind without its
 * collection tag is a type error.
 */
export const CACHE_TAG_COLLECTIONS: Readonly<Record<CacheTagEntity, string>> = {
    accommodation: 'list-accom',
    destination: 'list-dest',
    event: 'list-event',
    post: 'list-post'
} as const;

/** The home page — carries featured content from every collection. */
export const CACHE_TAG_HOME = 'home';

/** The subscriber pricing/comparison pages, driven by billing plan writes. */
export const CACHE_TAG_PRICING = 'pricing';

/**
 * Site-wide machine-readable configuration: `robots.txt`, `llms.txt`.
 * These are cacheable, public, and change with platform settings rather than
 * with any single entity — without this tag they would be the one cacheable
 * surface with no purge path at all.
 */
export const CACHE_TAG_SITE_CONFIG = 'site-config';

/** Maximum characters in one tag (Cloudflare limit). */
export const MAX_CACHE_TAG_LENGTH = 1024;

/** Maximum number of tags one response may carry (Cloudflare limit). */
export const MAX_CACHE_TAGS_PER_RESPONSE = 1000;

/** Maximum size in bytes of the aggregate `Cache-Tag` header (Cloudflare limit). */
export const MAX_CACHE_TAG_HEADER_BYTES = 16 * 1024;

/** The `Cache-Tag` response header name. Cloudflare strips it before the client. */
export const CACHE_TAG_HEADER_NAME = 'Cache-Tag';

/**
 * Printable ASCII excluding the comma (the list separator) — the set of
 * characters Cloudflare accepts inside a single tag.
 */
const VALID_TAG_PATTERN = /^[\x21-\x2B\x2D-\x7E]+$/;

/**
 * Whether a string is usable as a Cloudflare cache tag.
 *
 * @param params.tag - The candidate tag.
 * @returns `true` when the tag is non-empty, within the length limit, and made
 *   only of printable ASCII without spaces or commas.
 */
export function isValidCacheTag({ tag }: { readonly tag: string }): boolean {
    if (tag.length === 0 || tag.length > MAX_CACHE_TAG_LENGTH) return false;
    return VALID_TAG_PATTERN.test(tag);
}

/**
 * Normalize an entity key (a slug or a UUID) into the form used inside a cache
 * tag: trimmed and lowercased, to match Cloudflare's case-insensitive purge
 * semantics.
 *
 * @param params.key - Raw slug or id, possibly empty or oddly cased.
 * @returns The normalized key, or `null` when the key cannot yield a valid tag.
 */
export function normalizeCacheTagKey({ key }: { readonly key: string }): string | null {
    const normalized = key.trim().toLowerCase();
    if (normalized.length === 0) return null;
    return isValidCacheTag({ tag: normalized }) ? normalized : null;
}

/**
 * Build the cache tag addressing one concrete entity.
 *
 * @param params.entity - The entity kind.
 * @param params.key - The entity's slug or id.
 * @returns The tag (e.g. `accom-cabana-del-rio`), or `null` when the key is
 *   unusable — callers drop `null` rather than emitting a malformed tag that
 *   Cloudflare would silently discard.
 */
export function buildEntityCacheTag({
    entity,
    key
}: {
    readonly entity: CacheTagEntity;
    readonly key: string;
}): string | null {
    const normalized = normalizeCacheTagKey({ key });
    if (normalized === null) return null;
    return `${CACHE_TAG_ENTITY_PREFIXES[entity]}-${normalized}`;
}

/**
 * Build every cache tag addressing one entity, from whichever identifiers the
 * caller happens to hold.
 *
 * BOTH the slug and the id produce a tag, and a response tags itself with both.
 * This is deliberate: the ~40 revalidation call sites are not consistent about
 * which identifier they carry — content services pass `slug`, while the
 * plan-downgrade/upgrade remediation paths pass `id` and fall back to an
 * id-only event when the slug lookup fails. Emitting one and purging by the
 * other would purge nothing, silently. Two tags per entity is a few dozen bytes
 * against a 16 KB budget; a missed purge is stale content for the whole TTL.
 *
 * @param params.entity - The entity kind.
 * @param params.slug - The entity's URL slug, when known.
 * @param params.id - The entity's stable UUID, when known.
 * @returns Deduplicated tags; empty when neither identifier is usable.
 */
export function buildEntityCacheTags({
    entity,
    slug,
    id
}: {
    readonly entity: CacheTagEntity;
    readonly slug?: string | undefined;
    readonly id?: string | undefined;
}): readonly string[] {
    const tags = new Set<string>();
    for (const key of [slug, id]) {
        if (typeof key !== 'string') continue;
        const tag = buildEntityCacheTag({ entity, key });
        if (tag !== null) tags.add(tag);
    }
    return Array.from(tags);
}

/** Outcome of serializing a tag set into a `Cache-Tag` header value. */
export interface SerializedCacheTags {
    /** The header value, or `null` when no valid tag survived. */
    readonly header: string | null;
    /** How many tags the header actually carries. */
    readonly tagCount: number;
    /** Tags dropped as invalid, duplicate, or over a Cloudflare limit. */
    readonly droppedCount: number;
}

/**
 * Serialize tags into a `Cache-Tag` header value, enforcing every Cloudflare
 * limit up front.
 *
 * Over-limit tags are dropped rather than allowed to ship, because Cloudflare
 * would drop them anyway — silently, and only at storage time. Dropping them
 * here makes the loss countable ({@link SerializedCacheTags.droppedCount}) so a
 * caller can log it instead of discovering it as unexplained stale content.
 *
 * @param params.tags - Candidate tags, in priority order: the head of the list
 *   survives truncation, so callers should put entity tags before broad
 *   collection tags.
 * @returns The header value plus the counts needed to detect silent loss.
 */
export function serializeCacheTags({
    tags
}: {
    readonly tags: Iterable<string>;
}): SerializedCacheTags {
    const accepted: string[] = [];
    const seen = new Set<string>();
    let droppedCount = 0;
    let bytes = 0;

    for (const raw of tags) {
        const tag = raw.trim().toLowerCase();
        if (!isValidCacheTag({ tag }) || seen.has(tag)) {
            droppedCount++;
            continue;
        }
        // +1 for the separating comma on every tag after the first.
        const projected = bytes + tag.length + (accepted.length === 0 ? 0 : 1);
        if (
            accepted.length >= MAX_CACHE_TAGS_PER_RESPONSE ||
            projected > MAX_CACHE_TAG_HEADER_BYTES
        ) {
            droppedCount++;
            continue;
        }
        seen.add(tag);
        accepted.push(tag);
        bytes = projected;
    }

    return {
        header: accepted.length > 0 ? accepted.join(',') : null,
        tagCount: accepted.length,
        droppedCount
    };
}
