/**
 * @file ListingQrSheet.client.tsx
 * @description The owner-facing download of a listing's printable QR sheet
 * (HOS-982 PR 2), for the three verticals that print one.
 *
 * ## Why one island for three verticals
 *
 * The sheet itself is one document: `services/listing-qr-sheet/qr-sheet-content.ts`
 * renders the SAME page for an accommodation, a restaurant and an experience, and
 * says out loud that splitting it per vertical would give three copies of one
 * design that drift the first time anyone edits one. The surface that downloads it
 * inherits that argument — the only thing that differs between the three routes is
 * the path segment in {@link API_SEGMENT_BY_VERTICAL}.
 *
 * ## Why this is an island and not `<a download href="{API}/…">`
 *
 * Because that was tried, on this exact shape, and it saves a 401 to the owner's
 * disk: the API is a different origin, so a plain anchor travels WITHOUT the
 * session cookie (measured in HOS-376, written down again in
 * `BrochureDownloadButton.client.tsx` and in `qr-sheet-response.ts`). The fetch
 * below carries `credentials: 'include'` and hands the bytes over through an
 * object URL, which is a local hand-off of a file the server generated whole — not
 * a PDF assembled in the page.
 *
 * ## "Not published yet" comes from the CARD, never from the 404
 *
 * The route answers ONE 404 for three different situations — the listing does not
 * exist, it belongs to somebody else, or it is not publicly visible — on purpose:
 * a distinguishable refusal would let a caller confirm which ids are real
 * (`apps/api/docs/error-contract.md`). So this component cannot read "publish it
 * first" out of a response, and does not try. The caller passes
 * {@link ListingQrSheetProps.isPublished}, resolved from the listing state the
 * surrounding card already holds, and the unpublished branch renders instead of
 * the button. The 404 branch below is the RACE — published in this tab,
 * unpublished in another — and says so.
 *
 * ## There is no in-page preview of the code, and that is not an oversight
 *
 * The route returns `application/pdf`, and neither way of showing that in the page
 * is available: `object-src 'none'` plus a `frame-src` that carries no `blob:`
 * (see `lib/middleware-helpers.ts`) rules out embedding the file, and drawing the
 * symbol client-side would mean a second QR generator, which
 * `scripts/check-qrcode-engine-isolation.sh` exists to forbid. Showing the code
 * before the download needs an endpoint that returns its SVG — the shape
 * `gastronomy/protected/menuQr.ts` already has for the MENU purpose — and that is
 * an owner decision, not this file's.
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LoadingButton } from '@/components/shared/feedback/LoadingButton';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ListingQrSheet.module.css';

/**
 * API path segment per vertical — mirrors the three protected route mounts
 * (`accommodation`, `gastronomy` and `experience`'s `protected/qrSheet.ts`).
 *
 * A map rather than a ternary: `check-no-binary-vertical-ternary.sh` exists
 * because eleven sites decided a vertical with `x === 'gastronomy' ? A : B` and
 * every one of them silently answered `B` for `'accommodation'` (HOS-1079). With
 * three verticals in play here that mistake would be one keystroke away.
 */
const API_SEGMENT_BY_VERTICAL = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
} as const;

/** The three verticals whose listings print a QR sheet. */
export type ListingQrSheetVertical = keyof typeof API_SEGMENT_BY_VERTICAL;

export interface ListingQrSheetProps {
    /** Which vertical the listing belongs to. Decides the API path segment. */
    readonly vertical: ListingQrSheetVertical;
    /** The listing's id. */
    readonly listingId: string;
    /** The listing's slug — the fallback download filename. */
    readonly slug: string;
    /** Active locale: translates this panel AND the language the sheet prints in. */
    readonly locale: SupportedLocale;
    /**
     * Whether the listing has a public page right now.
     *
     * Resolved by the CALLER from the listing state it already holds — an
     * accommodation is `lifecycleState === ACTIVE && visibility === PUBLIC`, a
     * commerce listing is `isPublic`. It is deliberately not derived from a failed
     * request: see the module docblock.
     */
    readonly isPublished: boolean;
}

/** Why the download did not happen. Each one gets its own sentence. */
type SheetErrorReason = 'notFound' | 'rateLimited' | 'signedOut' | 'generic';

/** What the panel is doing right now. */
type SheetState =
    | { readonly status: 'idle' }
    | { readonly status: 'working' }
    | { readonly status: 'ready' }
    | { readonly status: 'error'; readonly reason: SheetErrorReason };

/**
 * Maps a refused response onto the sentence the owner reads.
 *
 * The three named statuses are the ones the route can actually produce for a
 * caller who got this far, and they need different answers: a 429 resolves by
 * waiting, a 401 by signing in again, and a 404 by checking the listing is still
 * published. Collapsing them into one "try again later" would send an owner to
 * retry a thing that cannot start working.
 *
 * @param status - HTTP status of the refused response.
 * @returns The reason key for the message to render.
 */
export function resolveQrSheetErrorReason(status: number): SheetErrorReason {
    if (status === 401) {
        return 'signedOut';
    }
    if (status === 404) {
        return 'notFound';
    }
    if (status === 429) {
        return 'rateLimited';
    }
    return 'generic';
}

/**
 * Reads the filename the server chose, falling back to the listing slug.
 *
 * The header is `attachment; filename="qr-x.pdf"` (`qr-sheet-response.ts`). A
 * missing or unparsable one is not worth failing over — the file is already in
 * hand.
 *
 * @param input - The raw `Content-Disposition` header and the listing slug.
 * @returns The name to save the file under.
 */
export function resolveQrSheetFilename(input: {
    readonly disposition: string | null;
    readonly slug: string;
}): string {
    const match = /filename="([^"]+)"/.exec(input.disposition ?? '');
    return match?.[1] ?? `qr-${input.slug}.pdf`;
}

/**
 * ListingQrSheet — downloads one listing's printable QR sheet.
 *
 * @param props - {@link ListingQrSheetProps}.
 * @returns The panel element.
 *
 * @example
 * ```tsx
 * <ListingQrSheet
 *   vertical="gastronomy"
 *   listingId={listing.id}
 *   slug={listing.slug}
 *   locale={locale}
 *   isPublished={listing.isPublic}
 * />
 * ```
 */
export function ListingQrSheet({
    vertical,
    listingId,
    slug,
    locale,
    isPublished
}: ListingQrSheetProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<SheetState>({ status: 'idle' });
    const helpId = useId();
    /**
     * The panel itself, used only to find the button again for focus.
     *
     * The button is `LoadingButton`, a plain function component that spreads its
     * rest props onto a native `<button>` — reaching into it with a forwarded
     * `ref` would be relying on a hand-off it does not declare. The panel holds
     * exactly one button, so finding it from here is both stable and honest.
     */
    const panelRef = useRef<HTMLDivElement | null>(null);
    const previousStatus = useRef<SheetState['status']>('idle');
    /**
     * The object URL of the last download, kept only so it can be released.
     *
     * It is NOT revoked when the save starts: revoking before the browser has
     * begun writing aborts the download in Safari (the same fix already carried by
     * `BrochureDownloadButton` and `GastronomyMenuQrWidget`). It is released when a
     * later download replaces it — that save finished long ago — and on unmount.
     */
    const objectUrlRef = useRef<string | null>(null);

    useEffect(
        () => () => {
            if (objectUrlRef.current !== null) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        },
        []
    );

    /**
     * Returns focus to the button when the work ends.
     *
     * `LoadingButton` disables itself while busy, and a disabled element loses
     * focus — a keyboard user who pressed Enter here is dropped at the top of the
     * document and has to tab back through the whole card to read what happened.
     * Restoring focus puts them back on the control they operated, next to the
     * live region that just announced the outcome.
     */
    useEffect(() => {
        if (previousStatus.current === 'working' && state.status !== 'working') {
            panelRef.current?.querySelector('button')?.focus();
        }
        previousStatus.current = state.status;
    }, [state.status]);

    const handleDownload = useCallback(async (): Promise<void> => {
        if (state.status === 'working') {
            return;
        }
        setState({ status: 'working' });

        try {
            const url = `${getApiUrl()}/api/v1/protected/${API_SEGMENT_BY_VERTICAL[vertical]}/${listingId}/qr-sheet`;
            const response = await fetch(url, {
                // Without this the browser sends no session cookie and writes the
                // 401 body to the owner's disk as a .pdf.
                credentials: 'include',
                // The API resolves the SHEET's language from this header (the same
                // signal the checkout return URLs read), so a sheet asked for from
                // an /en/ page prints in English. It does NOT decide where the code
                // lands — that is pinned to the market locale on the row itself.
                headers: { 'X-Client-Locale': locale }
            });

            if (!response.ok) {
                setState({ status: 'error', reason: resolveQrSheetErrorReason(response.status) });
                return;
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            if (objectUrlRef.current !== null) {
                URL.revokeObjectURL(objectUrlRef.current);
            }
            objectUrlRef.current = objectUrl;

            // The anchor is created for the click and thrown away. A rendered one
            // would have to be hidden from assistive technology, and a hidden link
            // with no accessible content is exactly what it sounds like.
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
        }
    }, [listingId, locale, slug, state.status, vertical]);

    if (!isPublished) {
        return (
            <p
                className={styles.hint}
                data-testid="listing-qr-sheet-unpublished"
            >
                {t(
                    'common.qrSheet.unpublished',
                    'Vas a poder descargar la hoja QR cuando tu ficha esté publicada.'
                )}
            </p>
        );
    }

    return (
        <div
            ref={panelRef}
            className={styles.panel}
            data-testid="listing-qr-sheet"
        >
            <p
                className={styles.hint}
                id={helpId}
            >
                {t(
                    'common.qrSheet.help',
                    'Una hoja A4 con el código de tu ficha, para imprimir y pegar en la puerta o dejar en el mostrador.'
                )}
            </p>

            <LoadingButton
                className={styles.button}
                loading={state.status === 'working'}
                loadingLabel={t('common.qrSheet.working', 'Generando la hoja…')}
                aria-describedby={helpId}
                onClick={() => {
                    void handleDownload();
                }}
                data-testid="listing-qr-sheet-download"
            >
                {t('common.qrSheet.download', 'Descargar la hoja QR (PDF)')}
            </LoadingButton>

            {state.status === 'ready' && (
                <p
                    className={styles.ready}
                    role="status"
                    data-testid="listing-qr-sheet-ready"
                >
                    {t('common.qrSheet.ready', 'Listo, descargamos tu hoja QR.')}
                </p>
            )}

            {state.status === 'error' && (
                <p
                    className={styles.error}
                    role="alert"
                    data-testid="listing-qr-sheet-error"
                >
                    {state.reason === 'notFound' &&
                        t(
                            'common.qrSheet.errorNotFound',
                            'No pudimos generar la hoja. Revisá que tu ficha siga publicada.'
                        )}
                    {state.reason === 'rateLimited' &&
                        t(
                            'common.qrSheet.errorRateLimited',
                            'Pediste la hoja varias veces seguidas. Esperá un minuto y probá de nuevo.'
                        )}
                    {state.reason === 'signedOut' &&
                        t(
                            'common.qrSheet.errorSignedOut',
                            'Se cerró tu sesión. Volvé a entrar para descargar la hoja.'
                        )}
                    {state.reason === 'generic' &&
                        t(
                            'common.qrSheet.error',
                            'No pudimos generar la hoja. Probá de nuevo en un momento.'
                        )}
                </p>
            )}
        </div>
    );
}
