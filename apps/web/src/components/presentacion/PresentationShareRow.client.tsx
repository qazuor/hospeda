/**
 * @file PresentationShareRow.client.tsx
 * @description Share row under each card of the `/presentacion/` index (HOS-2359
 * §6.D.3, owner decision OD-5).
 *
 * Five actions per presentation. WhatsApp, Facebook, X and Telegram open the
 * network's composer with that channel's `/go/` short link; Copy puts the
 * `copy`-channel short link on the clipboard. Each short link 302s to the
 * canonical presentation with campaign UTMs, so the visit is attributed to the
 * channel it was sent through. The card link itself stays the canonical URL.
 *
 * Nothing here is per-user, so the index stays cacheable and session-blind.
 * Copy feedback is an inline `role="status"` message rather than a toast:
 * `StandaloneLayout` deliberately renders no `ToastViewport`.
 *
 * Hydrate with `client:visible` (caller's responsibility).
 */
import type { PresentationAudience } from '@repo/analytics';
import { CopyIcon, FacebookIcon, TelegramIcon, WhatsappIcon, XIcon } from '@repo/icons';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
    buildPresentationShortSlug,
    buildPresentationShortUrl
} from '@/lib/attribution/presentation-links';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildShareIntentUrl, type ShareIntentNetwork } from '@/lib/share-intents';
import styles from './PresentationShareRow.module.css';

/** Props of {@link PresentationShareRow}. */
export interface PresentationShareRowProps {
    /** The presentation this row shares. */
    readonly presentation: {
        readonly slug: PresentationAudience;
        readonly name: string;
        readonly headline: string;
    };
    /** The web app's public URL; short links are built on its origin. */
    readonly siteUrl: string;
    /** Locale for the action labels. */
    readonly locale: SupportedLocale;
}

/** One network action: key, visible label, i18n key and icon. */
interface NetworkAction {
    readonly network: ShareIntentNetwork;
    readonly label: string;
    readonly labelKey: string;
    readonly fallback: string;
    readonly icon: ReactNode;
}

const NETWORK_ACTIONS: readonly NetworkAction[] = [
    {
        network: 'whatsapp',
        label: 'WhatsApp',
        labelKey: 'presentations.share.whatsapp',
        fallback: 'Compartir por WhatsApp',
        icon: (
            <WhatsappIcon
                size={18}
                aria-hidden="true"
            />
        )
    },
    {
        network: 'facebook',
        label: 'Facebook',
        labelKey: 'presentations.share.facebook',
        fallback: 'Compartir en Facebook',
        icon: (
            <FacebookIcon
                size={18}
                aria-hidden="true"
            />
        )
    },
    {
        network: 'x',
        label: 'X',
        labelKey: 'presentations.share.x',
        fallback: 'Compartir en X',
        icon: (
            <XIcon
                size={18}
                aria-hidden="true"
            />
        )
    },
    {
        network: 'telegram',
        label: 'Telegram',
        labelKey: 'presentations.share.telegram',
        fallback: 'Compartir por Telegram',
        icon: (
            <TelegramIcon
                size={18}
                aria-hidden="true"
            />
        )
    }
];

/** How long the copy confirmation stays visible, in ms. */
const COPY_FEEDBACK_MS = 2500;

/**
 * Renders the five share actions of one presentation.
 *
 * @param props - See {@link PresentationShareRowProps}
 * @returns The share row
 */
export function PresentationShareRow({ presentation, siteUrl, locale }: PresentationShareRowProps) {
    const { t } = createTranslations(locale);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        },
        []
    );

    const shortUrl = (channel: ShareIntentNetwork | 'copy'): string =>
        buildPresentationShortUrl({
            siteUrl,
            slug: buildPresentationShortSlug({ audience: presentation.slug, channel })
        });
    const copyUrl = shortUrl('copy');
    const copyUrlText = copyUrl.replace(/^https?:\/\//, '');

    async function handleCopy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(copyUrl);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
    }

    const statusText =
        copyState === 'copied'
            ? t('presentations.share.copied', 'Enlace copiado')
            : copyState === 'failed'
              ? t('presentations.share.copyFailed', 'No se pudo copiar el enlace')
              : '';

    return (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset would imply a form; this is a toolbar-like group of links.
        <div
            role="group"
            className={styles.root}
            aria-label={`${t('presentations.share.label', 'Compartir la presentación')}: ${presentation.name}`}
        >
            <ul className={styles.list}>
                {NETWORK_ACTIONS.map((action) => (
                    <li key={action.network}>
                        <a
                            className={styles.action}
                            href={buildShareIntentUrl({
                                network: action.network,
                                url: shortUrl(action.network),
                                title: presentation.headline
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${t(action.labelKey, action.fallback)}: ${presentation.name}`}
                        >
                            {action.icon}
                            <span className={styles.label}>{action.label}</span>
                        </a>
                    </li>
                ))}
                <li>
                    <button
                        type="button"
                        className={styles.action}
                        aria-label={`${t('presentations.share.copy', 'Copiar enlace')}: ${presentation.name}`}
                        onClick={() => void handleCopy()}
                    >
                        <CopyIcon
                            size={18}
                            aria-hidden="true"
                        />
                        <span className={styles.label}>
                            {t('presentations.share.copy', 'Copiar enlace')}
                        </span>
                    </button>
                </li>
            </ul>
            <p className={styles.url}>{copyUrlText}</p>
            <p
                role="status"
                className={
                    copyState === 'failed'
                        ? `${styles.status} ${styles.statusFailed}`
                        : styles.status
                }
            >
                {statusText}
            </p>
        </div>
    );
}
