import type { Seo } from '@repo/schemas';

export const SEO_LIMITS = {
    title: { min: 50, max: 60 },
    description: { min: 120, max: 155, validationMax: 160 }
} as const;

/** Default locale used in SEO preview URLs. */
export const SEO_DEFAULT_LOCALE = 'es' as const;

export interface SeoFormValues {
    readonly title: string;
    readonly description: string;
}

export const normalizeSeoText = (value: string | null | undefined): string => value?.trim() ?? '';

export const buildSeoFormValues = (seo: Seo | null | undefined): SeoFormValues => ({
    title: seo?.title ?? '',
    description: seo?.description ?? ''
});

export const buildSeoPayload = ({ description, title }: SeoFormValues): Seo | null => {
    const normalizedTitle = normalizeSeoText(title);
    const normalizedDescription = normalizeSeoText(description);

    if (!normalizedTitle && !normalizedDescription) {
        return null;
    }

    return {
        ...(normalizedTitle ? { title: normalizedTitle } : {}),
        ...(normalizedDescription ? { description: normalizedDescription } : {})
    };
};

export const buildSeoPreviewTitle = ({
    fallbackTitle,
    title
}: {
    readonly title: string;
    readonly fallbackTitle: string;
}): string => {
    const resolvedTitle = normalizeSeoText(title) || normalizeSeoText(fallbackTitle);

    if (!resolvedTitle) {
        return 'Hospeda';
    }

    return `${resolvedTitle} | Hospeda`;
};

export const buildSeoPreviewDescription = ({
    description,
    fallbackDescription
}: {
    readonly description: string;
    readonly fallbackDescription: string;
}): string => normalizeSeoText(description) || normalizeSeoText(fallbackDescription);

export const truncateSeoPreview = ({
    text,
    maxLength
}: {
    readonly text: string;
    readonly maxLength: number;
}): string => {
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 1)}…`;
};

export const getSeoCounterTone = ({
    length,
    min,
    max,
    validationMax
}: {
    readonly length: number;
    readonly min: number;
    readonly max: number;
    readonly validationMax?: number;
}): string => {
    if (length === 0) {
        return 'text-muted-foreground';
    }

    if (validationMax !== undefined) {
        if (length > validationMax) {
            return 'text-destructive';
        }
        if (length > max) {
            return 'text-warning';
        }
    } else {
        if (length > max) {
            return 'text-destructive';
        }
    }

    if (length < min) {
        return 'text-warning';
    }

    if (length >= max - 5) {
        return 'text-warning';
    }

    return 'text-success';
};

export const buildSeoPreviewUrl = ({
    locale,
    pathSegment,
    siteUrl,
    slug
}: {
    readonly siteUrl: string;
    readonly locale: string;
    readonly pathSegment: string;
    readonly slug: string | null | undefined;
}): string => {
    const trimmedSiteUrl = siteUrl.replace(/\/$/, '');
    const trimmedSlug = normalizeSeoText(slug);

    if (!trimmedSlug) {
        return `${trimmedSiteUrl}/${locale}/${pathSegment}/`;
    }

    return `${trimmedSiteUrl}/${locale}/${pathSegment}/${trimmedSlug}/`;
};
