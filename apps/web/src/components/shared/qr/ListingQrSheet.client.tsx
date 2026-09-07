/**
 * @file ListingQrSheet.client.tsx
 * @description The owner's listing QR: the code on screen, and the printable
 * sheet behind it (HOS-982 PR 2), for the three verticals that print one.
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
 * ## Why the code arrives as SVG from its own endpoint
 *
 * A button that downloads a PDF blind tells nobody what they got, so the panel
 * shows the symbol first (owner decision). It cannot show it out of the PDF: the
 * app's own CSP sends `object-src 'none'`, and no branch of its `frame-src`
 * carries `blob:` (`lib/middleware-helpers.ts` — dev does add `'self'`, for
 * Astro's ClientRouter, but `'self'` does not authorise a blob URL), so an
 * embedded file renders nothing and reports nothing. Nor can it draw one: that
 * would be a second QR generator, which
 * `scripts/check-qrcode-engine-isolation.sh` exists to forbid.
 *
 * What the CSP DOES allow is `img-src … data:`, so `GET …/{id}/qr` returns the
 * markup and it is inlined as a `data:image/svg+xml` image — the same shape
 * `ProviderQrPanel` and `GastronomyMenuQrWidget` already use, and rendered through
 * `<img>` rather than injected into the DOM because a browser disables scripting
 * inside an SVG loaded as an image.
 *
 * The image is not a preview of the sheet; it is THE code the sheet prints. Both
 * endpoints resolve the same `qr_codes` row — same entity, same `LISTING`
 * purpose — so what the owner checks on screen is what ends up on the door.
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LoadingButton } from '@/components/shared/feedback/LoadingButton';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildSvgDataUrl } from '@/lib/qr/qr-png';
import styles from './ListingQrSheet.module.css';

/**
 * API path segment per vertical — mirrors the protected route mounts of both
 * `protected/qrCode.ts` (the image) and `protected/qrSheet.ts` (the PDF).
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
 * The symbol itself, fetched once when the panel mounts.
 *
 * Its `error` state is deliberately quiet and NEVER blocks the button: the image
 * is what makes the download understandable, not what makes it work. A panel
 * that hid the download because a picture failed would have turned an
 * enhancement into a dependency.
 */
type CodeState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly svg: string; readonly url: string }
    | { readonly status: 'error' };

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
 * ListingQrSheet — shows one listing's QR and downloads its printable sheet.
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
    const [code, setCode] = useState<CodeState>({ status: 'loading' });
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

    /**
     * Fetches the symbol so the owner sees WHAT they are about to print.
     *
     * Only for a published listing: the route answers 404 for anything else, and
     * asking anyway would spend a request to learn what the caller already knows.
     *
     * No `X-Client-Locale` here, unlike the download below. That header decides
     * what language the SHEET is printed in; this response carries no copy at all,
     * so sending it would imply a choice this endpoint does not make. The
     * destination the code is minted with is pinned to the market locale
     * server-side and follows nobody's browser.
     *
     * A failure sets `error` and stops. There is no retry and no message beyond a
     * quiet line, because the button beside it still works.
     */
    useEffect(() => {
        if (!isPublished) {
            return;
        }

        let cancelled = false;
        setCode({ status: 'loading' });

        (async () => {
            try {
                const endpoint = `${getApiUrl()}/api/v1/protected/${API_SEGMENT_BY_VERTICAL[vertical]}/${listingId}/qr`;
                const response = await fetch(endpoint, { credentials: 'include' });
                if (!response.ok) {
                    if (!cancelled) setCode({ status: 'error' });
                    return;
                }
                const body = (await response.json()) as {
                    data?: { svg?: string; url?: string };
                };
                const svg = body.data?.svg;
                const url = body.data?.url;
                if (cancelled) {
                    return;
                }
                // Both or neither: rendering an image with no URL beside it, or a
                // URL with no image, would each be a half-answer presented as a
                // whole one.
                setCode(svg && url ? { status: 'ready', svg, url } : { status: 'error' });
            } catch {
                if (!cancelled) setCode({ status: 'error' });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isPublished, listingId, vertical]);

    const handleDownload = useCallback(async (): Promise<void> => {
        // A second line, and unreachable from the UI: `LoadingButton` disables
        // itself while `loading`, so the button cannot dispatch a second click.
        // No test covers this branch and none can through the rendered control —
        // said out loud because a test named after it WOULD pass with it deleted,
        // which is what an adversarial review found here.
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
            {code.status === 'loading' && (
                <div
                    className={styles.codeFrame}
                    data-testid="listing-qr-sheet-code-loading"
                >
                    <Spinner
                        label={t('common.qrSheet.codeLoading', 'Cargando el código…')}
                        size="md"
                    />
                </div>
            )}

            {code.status === 'ready' && (
                <div className={styles.codeFrame}>
                    {/*
                     * Rendered through `<img src="data:…">` rather than injected as
                     * markup: both look identical and only one of them cannot
                     * execute script, because a browser disables scripting inside
                     * an SVG loaded as an image. Same choice as `ProviderQrPanel`,
                     * and the CSP already allows `data:` under `img-src`.
                     */}
                    <img
                        alt={t('common.qrSheet.codeAlt', 'Código QR de tu ficha')}
                        className={styles.codeImage}
                        data-testid="listing-qr-sheet-code"
                        src={buildSvgDataUrl(code.svg)}
                    />
                    {/*
                     * What the symbol ENCODES, so it can be checked by eye. It is
                     * not a health check and must not be read as one: an operator
                     * can retire a code (`isActive: false`) without deleting it,
                     * and `QrCodeService._findLiveCodeForEntity` filters only on
                     * `deletedAt` while the public redirect also refuses inactive
                     * rows — so this line would name a URL that 404s on every
                     * scan. The predicate belongs to the QR engine (HOS-981) and
                     * reaches all four purposes; it is recorded here and in
                     * `services/listing-qr-sheet/listing-qr-code.ts`, not fixed.
                     */}
                    <p className={styles.codeUrl}>
                        {t('common.qrSheet.encodes', 'El código lleva a: {{url}}', {
                            url: code.url
                        })}
                    </p>
                </div>
            )}

            {code.status === 'error' && (
                <p
                    className={styles.hint}
                    data-testid="listing-qr-sheet-code-error"
                >
                    {/*
                     * Not `role="alert"`, and not a blocker: the download beside it
                     * still works, so this is a note rather than a failure.
                     */}
                    {t(
                        'common.qrSheet.codeError',
                        'No pudimos mostrar el código acá, pero podés descargar la hoja igual.'
                    )}
                </p>
            )}

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
