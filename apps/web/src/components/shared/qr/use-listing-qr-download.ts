/** Shared authenticated QR-sheet download controller for cards and standalone panels. */
import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';

/** Protected route segments for the verticals that provide a printable QR sheet. */
export const QR_API_SEGMENT_BY_VERTICAL = {
    accommodation: 'accommodations',
    venue: 'venues',
    experience: 'experiences'
} as const;

/** Refusals are actionable independently of the optional QR preview. */
export type SheetErrorReason = 'notFound' | 'rateLimited' | 'signedOut' | 'generic';
type SheetState =
    | { readonly status: 'idle' | 'working' | 'ready' }
    | { readonly status: 'error'; readonly reason: SheetErrorReason };

/** Maps the protected route's refusal to an actionable message key. */
export function resolveQrSheetErrorReason(status: number): SheetErrorReason {
    if (status === 401) return 'signedOut';
    if (status === 404) return 'notFound';
    if (status === 429) return 'rateLimited';
    return 'generic';
}

/** Uses the server's filename, with a slug-based fallback. */
export function resolveQrSheetFilename(input: {
    readonly disposition: string | null;
    readonly slug: string;
}): string {
    return /filename="([^"]+)"/.exec(input.disposition ?? '')?.[1] ?? `qr-${input.slug}.pdf`;
}

/** Downloads the existing server PDF without fetching or generating a QR preview. */
export function useListingQrDownload({
    vertical,
    listingId,
    slug,
    locale
}: {
    readonly vertical: keyof typeof QR_API_SEGMENT_BY_VERTICAL;
    readonly listingId: string;
    readonly slug: string;
    readonly locale: SupportedLocale;
}) {
    const [state, setState] = useState<SheetState>({ status: 'idle' });
    const objectUrlRef = useRef<string | null>(null);
    const working = useRef(false);

    useEffect(
        () => () => {
            if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
        },
        []
    );

    async function handleDownload(): Promise<void> {
        if (working.current) return;
        working.current = true;
        setState({ status: 'working' });
        try {
            const response = await fetch(
                `${getApiUrl()}/api/v1/protected/${QR_API_SEGMENT_BY_VERTICAL[vertical]}/${listingId}/qr-sheet`,
                { credentials: 'include', headers: { 'X-Client-Locale': locale } }
            );
            if (!response.ok) {
                setState({ status: 'error', reason: resolveQrSheetErrorReason(response.status) });
                return;
            }
            const objectUrl = URL.createObjectURL(await response.blob());
            // Keep the URL alive until replacement/unmount: immediate revocation aborts Safari saves.
            if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = objectUrl;
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = resolveQrSheetFilename({
                disposition: response.headers.get('content-disposition'),
                slug
            });
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setState({ status: 'ready' });
        } catch {
            setState({ status: 'error', reason: 'generic' });
        } finally {
            working.current = false;
        }
    }

    return { state, handleDownload };
}
