/** Existing-data publication presentation; never a publish-eligibility decision. */
import type { StatusTone } from '@/components/account/ui/status-tone';
import type { SupportedLocale } from '@/lib/i18n';
import { ENTITY_PUBLIC_PATHS } from '@/lib/seo/entity-public-urls';
import { buildUrl } from '@/lib/urls';

const PUBLICATION_TONES: Readonly<Record<string, StatusTone>> = {
    DRAFT: 'warning',
    PUBLISHED: 'success',
    UNPUBLISHED_BY_BILLING: 'neutral',
    ARCHIVED: 'neutral',
    MODERATED: 'danger',
    PURGED: 'danger'
};

/** Resolves a status label and a published-only public link from already loaded facts. */
export function resolveEditorPublicationStatus({
    vertical,
    locale,
    publicationStatus,
    slug
}: {
    readonly vertical: string;
    readonly locale: SupportedLocale;
    readonly publicationStatus?: string | null;
    readonly slug?: string | null;
}): { readonly labelKey: string; readonly tone: StatusTone; readonly href?: string } {
    const known = publicationStatus != null && Object.hasOwn(PUBLICATION_TONES, publicationStatus);
    const publicPath =
        vertical === 'accommodation' || vertical === 'venue' || vertical === 'experience'
            ? ENTITY_PUBLIC_PATHS[vertical]
            : undefined;
    return {
        labelKey: known
            ? `host.properties.card.status.${publicationStatus}`
            : 'account.editorHub.publicationUnavailable',
        tone: known ? PUBLICATION_TONES[publicationStatus] : 'neutral',
        ...(publicationStatus === 'PUBLISHED' && slug && publicPath
            ? { href: buildUrl({ locale, path: publicPath(encodeURIComponent(slug)) }) }
            : {})
    };
}
