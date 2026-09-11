/**
 * @file resolve-commerce-editor-page.ts
 * @description Front-door for every commerce editor page (HOS-1080).
 *
 * The commerce counterpart of `resolve-editor-page.ts`. Eleven pages (the hub
 * plus the sections) need the same seven things before they can render: a
 * logged-in user, commerce access, a known vertical, an id in the route, the
 * listing loaded, an ownership check, and a clean redirect when any of those
 * fails. Written once here so a new section page cannot forget one of them —
 * which is exactly what the single pre-split route made easy to do, since it was
 * the only place any of this existed.
 *
 * The optional catalog fetches live here too rather than in the pages. The
 * pre-split route called `fetch()` straight from its frontmatter, in violation
 * of apps/web's own rule; copying that into ten pages is what a shared loader
 * exists to prevent (the accommodation editor's route guard asserts the same
 * absence).
 */

import type { AstroGlobal } from 'astro';
import type { DestinationOption } from '@/components/commerce/destination-option';
import { destinationsApi } from '@/lib/api/endpoints';
import { transformAmenityList } from '@/lib/api/transforms';
import type { AmenityData } from '@/lib/api/types';
import {
    type CommerceListingDetail,
    type CommerceVertical,
    fetchOwnerListingDetail
} from '@/lib/commerce/owner-listings';
import { buildCommerceEditorRegistry } from '@/lib/editor/commerce-editor-sections';
import {
    buildEditorHubUrl,
    type EditorRegistry,
    findEditorSectionBySlug
} from '@/lib/editor/editor-registry';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { hasCommerceNavAccess } from '@/lib/nav-gating';
import { buildUrl } from '@/lib/urls';

/** Extra payloads a page can ask the resolver to load. */
export type CommerceEditorDataNeed = 'catalog' | 'destinations';

/** What a commerce editor page gets back. Exactly one of `redirect` / `detail`. */
export type CommerceEditorPageResolution =
    | { readonly redirect: Response; readonly detail?: undefined }
    | {
          readonly redirect?: undefined;
          readonly detail: CommerceListingDetail;
          readonly locale: SupportedLocale;
          readonly vertical: CommerceVertical;
          readonly listingId: string;
          /** `null` on the hub, where no section is active. */
          readonly sectionId: string | null;
          readonly registry: EditorRegistry;
          readonly amenities: readonly AmenityData[];
          readonly features: readonly AmenityData[];
          readonly destinations: readonly DestinationOption[];
          /**
           * `true` when the destination catalog fetch FAILED, as opposed to
           * succeeding with a genuinely empty catalog. `destinationId` is
           * required for publish-readiness, so the editor must be able to tell
           * the two apart (HOS-166 judgment-day).
           */
          readonly destinationsLoadFailed: boolean;
      };

/**
 * Resolves everything a commerce editor page needs, or the redirect it should
 * return.
 *
 * @param params - The Astro global, the page's section slug (`null` for the
 * hub), and the extra payloads this page needs loaded.
 * @returns Either a redirect Response to return, or the loaded listing.
 */
export async function resolveCommerceEditorPage({
    astro,
    sectionSlug,
    need = []
}: {
    readonly astro: AstroGlobal;
    readonly sectionSlug: string | null;
    readonly need?: readonly CommerceEditorDataNeed[];
}): Promise<CommerceEditorPageResolution> {
    const locale = astro.locals.locale as SupportedLocale;

    const user = astro.locals.user;
    if (!user) {
        return { redirect: astro.redirect(buildUrl({ locale, path: 'auth/signin' })) };
    }

    // HOS-296: gate through the shared `nav-gating` predicate over the role SET,
    // so a COMMERCE_OWNER who is ALSO a HOST keeps commerce access (AC-1).
    if (!hasCommerceNavAccess({ roles: user.roles })) {
        return { redirect: astro.redirect(buildUrl({ locale, path: 'mi-cuenta' })) };
    }

    const verticalParam = astro.params.vertical;
    const listingId = astro.params.id;
    const isVertical = verticalParam === 'gastronomy' || verticalParam === 'experience';
    if (!isVertical || !listingId) {
        return { redirect: new Response(null, { status: 404 }) };
    }
    const vertical = verticalParam;

    const registry = buildCommerceEditorRegistry({ vertical });
    const hubUrl = buildEditorHubUrl({ locale, registry, entityId: listingId });

    // An unknown slug must not render a page claiming to be a section that does
    // not exist — send it to the hub, which always exists. This is also what
    // answers `/gastronomy/<id>/editar/punto-de-encuentro`: the experience-only
    // sections are absent from a gastronomy registry, so the lookup misses.
    const section =
        sectionSlug === null ? null : findEditorSectionBySlug({ registry, slug: sectionSlug });
    if (sectionSlug !== null && !section) {
        return { redirect: astro.redirect(hubUrl) };
    }

    const cookieHeader = astro.request.headers.get('cookie') ?? undefined;
    const detail = await fetchOwnerListingDetail({ vertical, id: listingId, cookieHeader });

    // Defensive UX gate: the protected getById does not enforce ownership, so a
    // non-owner (and non-staff) is bounced back to their listing index. The
    // write path (updateOwn) is the hard gate.
    // HOS-296: staff check over the role SET — an admin who also holds
    // COMMERCE_OWNER is still staff here.
    const isStaff = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
    const ownsListing = detail !== null && detail.ownerId === user.id;
    if (!detail || (!ownsListing && !isStaff)) {
        return { redirect: astro.redirect(buildUrl({ locale, path: registry.indexPath })) };
    }

    const { amenities, features } = need.includes('catalog')
        ? await loadCatalogs({ vertical })
        : { amenities: [], features: [] };

    const destinationsResult = need.includes('destinations')
        ? await destinationsApi.list({ destinationType: 'CITY', pageSize: 100 })
        : null;

    return {
        detail,
        locale,
        vertical,
        listingId,
        sectionId: section?.id ?? null,
        registry,
        amenities,
        features,
        destinations: destinationsResult?.ok
            ? destinationsResult.data.items.map((item) => ({ id: item.id, name: item.name }))
            : [],
        destinationsLoadFailed: destinationsResult !== null && !destinationsResult.ok
    };
}

/**
 * Loads the amenity and feature catalogs for one vertical.
 *
 * SPEC-266: filtered to the listing's actual vertical, so a brewery
 * (gastronomy) only sees gastronomy-scoped amenities and an experience listing
 * sees experience-scoped ones.
 *
 * Degrades cleanly: a failed fetch yields empty lists rather than a 500, which
 * the registry then reads as "no amenities section" instead of offering a link
 * to an empty page.
 *
 * @param params - The vertical to scope the catalogs to.
 * @returns The two catalogs, empty on any failure.
 */
async function loadCatalogs({ vertical }: { readonly vertical: CommerceVertical }): Promise<{
    readonly amenities: readonly AmenityData[];
    readonly features: readonly AmenityData[];
}> {
    const apiUrl = getApiUrl();

    try {
        const [amenitiesRes, featuresRes] = await Promise.all([
            fetch(`${apiUrl}/api/v1/public/amenities?pageSize=100&applicableVertical=${vertical}`),
            fetch(`${apiUrl}/api/v1/public/features?pageSize=100&applicableVertical=${vertical}`)
        ]);

        return {
            amenities: await readCatalog(amenitiesRes),
            features: await readCatalog(featuresRes)
        };
    } catch {
        // Catalog unavailable — the editor drops the amenities section entirely.
        return { amenities: [], features: [] };
    }
}

/**
 * Reads one catalog response into the shape the multi-select takes.
 *
 * @param response - The fetch response for a catalog endpoint.
 * @returns The catalog entries, empty when the response was not OK.
 */
async function readCatalog(response: Response): Promise<readonly AmenityData[]> {
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: { items?: Record<string, unknown>[] } };
    return transformAmenityList({ items: body.data?.items ?? [] });
}
