/**
 * AiAssistantsTabs — the two sections of «Asistentes de IA» as kit `NavTabs`
 * (HOS-2502): the connected assistants and the history of what they did.
 *
 * Rendered from the two Astro pages with no hydration: the tabs are plain links,
 * and the current one carries `aria-current="page"`.
 *
 * @module components/account/AiAssistantsTabs
 */

import { NavTabs } from '@/components/account/ui';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** Props of {@link AiAssistantsTabs}. */
export interface AiAssistantsTabsProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Which of the two pages is open. */
    readonly current: 'assistants' | 'history';
}

/**
 * The assistants / history tabs.
 *
 * @param props - See {@link AiAssistantsTabsProps}.
 * @returns A `<nav>` of two links.
 */
export function AiAssistantsTabs({ locale, current }: AiAssistantsTabsProps) {
    const t = createT(locale);
    return (
        <NavTabs
            ariaLabel={t('account.aiAssistants.tabs.label')}
            items={[
                {
                    href: buildUrl({ locale, path: 'mi-cuenta/asistentes-ia' }),
                    label: t('account.aiAssistants.tabs.assistants'),
                    current: current === 'assistants'
                },
                {
                    href: buildUrl({ locale, path: 'mi-cuenta/asistentes-ia/historial' }),
                    label: t('account.aiAssistants.tabs.history'),
                    current: current === 'history'
                }
            ]}
        />
    );
}
