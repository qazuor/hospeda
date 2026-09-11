/**
 * @file ExperienceCertificatePanel.client.tsx
 * @description Issues and lists the certificates of one experience listing
 * (HOS-1057).
 *
 * ## Why the panel asks the API before it renders anything
 *
 * The certificate is a paid capability and the listing summary the owner index
 * renders carries no entitlement information — the same situation
 * `BrochureDownloadButton` is in. So the panel mounts, asks for the list, and
 * lets the API decide: a 403 renders the upsell sentence and NOTHING else, so
 * an owner on the entry plan is never shown a form whose submit could only
 * refuse. A 403 is a state, never an error.
 *
 * ## Why the download is a fetch and not an anchor
 *
 * Measured on this exact shape in HOS-376 and repeated in HOS-1058: the API is
 * a different origin, so a plain `<a href="{API}/…">` travels WITHOUT the
 * session cookie and the browser saves a 401 to disk. The fetch below carries
 * `credentials: 'include'` and hands the blob over through an object URL.
 */

import type { FormEvent, JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ExperienceCertificatePanel.module.css';

/** Longest recipient name the API accepts. Mirrors the schema's own bound. */
const RECIPIENT_NAME_MAX_LENGTH = 120;

/** One issued certificate, as the API returns it. */
interface IssuedCertificate {
    readonly id: string;
    readonly recipientName: string;
    readonly completedAt: string;
    readonly issuedAt: string;
}

export interface ExperienceCertificatePanelProps {
    /** The experience listing whose certificates these are. */
    readonly listingId: string;
    /** Active locale — decides the language the SHEET is printed in. */
    readonly locale: SupportedLocale;
}

/** What the panel is doing right now. */
type PanelState = 'loading' | 'ready' | 'locked' | 'error';

/** Reads the filename the server chose, falling back to a generic one. */
function filenameFrom(disposition: string | null): string {
    const match = /filename="([^"]+)"/.exec(disposition ?? '');
    return match?.[1] ?? 'certificado.pdf';
}

/** Hands a blob to the user as a download. */
function saveBlob(input: { blob: Blob; filename: string }): void {
    const objectUrl = URL.createObjectURL(input.blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = input.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Freed on the next tick rather than immediately: revoking before the
    // browser has started the save aborts it in Safari.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

/**
 * Renders the certificate panel for one published experience listing.
 */
export function ExperienceCertificatePanel({
    listingId,
    locale
}: ExperienceCertificatePanelProps): JSX.Element | null {
    const { t } = createTranslations(locale);

    const [state, setState] = useState<PanelState>('loading');
    const [certificates, setCertificates] = useState<readonly IssuedCertificate[]>([]);
    const [recipientName, setRecipientName] = useState('');
    const [completedAt, setCompletedAt] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const baseUrl = `${getApiUrl()}/api/v1/protected/experiences/${listingId}/certificates`;

    const load = useCallback(async (): Promise<void> => {
        try {
            const response = await fetch(baseUrl, {
                credentials: 'include',
                headers: { 'X-Client-Locale': locale }
            });
            if (response.status === 403) {
                setState('locked');
                return;
            }
            if (!response.ok) {
                setState('error');
                return;
            }
            const body = (await response.json()) as {
                data?: { certificates?: IssuedCertificate[] };
                certificates?: IssuedCertificate[];
            };
            // The envelope shape differs between the raw payload and the
            // `ResponseFactory` wrapper depending on the route factory in play,
            // so both are accepted rather than assumed.
            setCertificates(body.data?.certificates ?? body.certificates ?? []);
            setState('ready');
        } catch {
            setState('error');
        }
    }, [baseUrl, locale]);

    useEffect(() => {
        void load();
    }, [load]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (submitting) {
            return;
        }
        setSubmitting(true);
        setFormError(null);

        try {
            const response = await fetch(baseUrl, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-Locale': locale
                },
                body: JSON.stringify({ recipientName: recipientName.trim(), completedAt })
            });

            if (response.status === 403) {
                setState('locked');
                return;
            }
            if (!response.ok) {
                setFormError(
                    t(
                        'commerce.certificate.error',
                        'No pudimos emitir el certificado. Probá de nuevo en un momento.'
                    )
                );
                return;
            }

            setRecipientName('');
            setCompletedAt('');
            await load();
        } catch {
            setFormError(
                t(
                    'commerce.certificate.error',
                    'No pudimos emitir el certificado. Probá de nuevo en un momento.'
                )
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDownload(certificateId: string): Promise<void> {
        if (downloadingId) {
            return;
        }
        setDownloadingId(certificateId);
        setFormError(null);

        try {
            const response = await fetch(`${baseUrl}/${certificateId}/pdf`, {
                credentials: 'include',
                headers: { 'X-Client-Locale': locale }
            });
            if (response.status === 403) {
                setState('locked');
                return;
            }
            if (!response.ok) {
                setFormError(
                    t(
                        'commerce.certificate.downloadError',
                        'No pudimos generar el certificado. Probá de nuevo en un momento.'
                    )
                );
                return;
            }
            saveBlob({
                blob: await response.blob(),
                filename: filenameFrom(response.headers.get('content-disposition'))
            });
        } catch {
            setFormError(
                t(
                    'commerce.certificate.downloadError',
                    'No pudimos generar el certificado. Probá de nuevo en un momento.'
                )
            );
        } finally {
            setDownloadingId(null);
        }
    }

    if (state === 'loading') {
        return null;
    }

    if (state === 'locked') {
        return (
            <section className={styles.panel}>
                <h3 className={styles.heading}>
                    {t('commerce.certificate.heading', 'Certificados')}
                </h3>
                <p className={styles.hint}>
                    {t(
                        'commerce.certificate.locked',
                        'Los certificados están disponibles desde el plan Profesional de Experiencias.'
                    )}
                </p>
            </section>
        );
    }

    if (state === 'error') {
        return (
            <section className={styles.panel}>
                <h3 className={styles.heading}>
                    {t('commerce.certificate.heading', 'Certificados')}
                </h3>
                <p
                    className={styles.error}
                    role="alert"
                >
                    {t(
                        'commerce.certificate.error',
                        'No pudimos emitir el certificado. Probá de nuevo en un momento.'
                    )}
                </p>
            </section>
        );
    }

    const nameFieldId = `certificate-recipient-${listingId}`;
    const dateFieldId = `certificate-date-${listingId}`;

    return (
        <section className={styles.panel}>
            <h3 className={styles.heading}>{t('commerce.certificate.heading', 'Certificados')}</h3>
            <p className={styles.hint}>
                {t(
                    'commerce.certificate.intro',
                    'Emitile un certificado a quien hizo la experiencia. Lo podés descargar, imprimir o mandárselo.'
                )}
            </p>

            <form
                className={styles.form}
                onSubmit={(event) => {
                    void handleSubmit(event);
                }}
            >
                <label
                    className={styles.field}
                    htmlFor={nameFieldId}
                >
                    <span className={styles.label}>
                        {t('commerce.certificate.recipientLabel', 'Nombre de quien la hizo')}
                    </span>
                    <input
                        id={nameFieldId}
                        className={styles.input}
                        type="text"
                        required
                        maxLength={RECIPIENT_NAME_MAX_LENGTH}
                        value={recipientName}
                        onChange={(event) => setRecipientName(event.target.value)}
                    />
                </label>

                <label
                    className={styles.field}
                    htmlFor={dateFieldId}
                >
                    <span className={styles.label}>
                        {t('commerce.certificate.dateLabel', 'Día en que la hizo')}
                    </span>
                    <input
                        id={dateFieldId}
                        className={styles.input}
                        type="date"
                        required
                        value={completedAt}
                        onChange={(event) => setCompletedAt(event.target.value)}
                    />
                </label>

                <button
                    type="submit"
                    className={styles.submit}
                    disabled={submitting}
                    aria-busy={submitting}
                    data-testid="experience-certificate-submit"
                >
                    {submitting
                        ? t('commerce.certificate.submitting', 'Emitiendo…')
                        : t('commerce.certificate.submit', 'Emitir certificado')}
                </button>
            </form>

            {formError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {formError}
                </p>
            )}

            {certificates.length === 0 ? (
                <p className={styles.hint}>
                    {t('commerce.certificate.empty', 'Todavía no emitiste ningún certificado.')}
                </p>
            ) : (
                <ul className={styles.list}>
                    {certificates.map((certificate) => (
                        <li
                            className={styles.item}
                            key={certificate.id}
                        >
                            <span className={styles.itemName}>{certificate.recipientName}</span>
                            <span className={styles.itemDate}>{certificate.completedAt}</span>
                            <button
                                type="button"
                                className={styles.link}
                                disabled={downloadingId === certificate.id}
                                aria-busy={downloadingId === certificate.id}
                                onClick={() => {
                                    void handleDownload(certificate.id);
                                }}
                                data-testid={`experience-certificate-download-${certificate.id}`}
                            >
                                {downloadingId === certificate.id
                                    ? t(
                                          'commerce.certificate.downloading',
                                          'Generando el certificado…'
                                      )
                                    : t('commerce.certificate.download', 'Descargar PDF')}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
