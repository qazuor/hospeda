/**
 * @file OwnerInboxLocked.tsx
 * @description What the owner inbox pages render for a signed-in user without
 * the owner permission (HOS-2482, HOS-2433): the kit `LockedState` with
 * `reason.kind = 'permission'`, inside a `Section`. Static (no hydration): it
 * holds links only.
 */

import { LockedState, Section } from '@/components/account/ui';
import { helpArticlePath } from '@/lib/help/help-tokens';
import { createT, type SupportedLocale } from '@/lib/i18n';

/** Help article about the owner inbox (`packages/help/content/es/host/inquiries.md`). */
const OWNER_INBOX_HELP_ARTICLE = 'inquiries';

/** Props of {@link OwnerInboxLocked}. */
export interface OwnerInboxLockedProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
}

/**
 * The locked owner inbox.
 *
 * @param props - See {@link OwnerInboxLockedProps}.
 * @returns A Section holding the permission LockedState.
 */
export function OwnerInboxLocked({ locale }: OwnerInboxLockedProps) {
    const t = createT(locale);
    return (
        <Section
            title={t('conversations.inbox.sectionTitle')}
            helpId="section:messages.owner-list"
        >
            <LockedState
                locale={locale}
                reason={{
                    kind: 'permission',
                    feature: t('conversations.ownerLocked.feature'),
                    description: t('conversations.ownerLocked.description'),
                    helpHref: helpArticlePath({ id: OWNER_INBOX_HELP_ARTICLE, locale })
                }}
            />
        </Section>
    );
}
