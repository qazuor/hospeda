/**
 * @file CalendarSectionGate.client.tsx
 * @description The calendar page island: {@link CalendarSection} behind the
 * `can_use_calendar` entitlement gate (HOS-2503).
 *
 * `PlanEntitlementGate` is shared by several editor sections, so its logic and
 * default fallback stay untouched. This wrapper only swaps WHAT renders when
 * the plan lacks the calendar: the kit `LockedState` inside a flat `Section`,
 * naming the cheapest plan that unlocks it (read from the catalog by the page).
 * When the catalog names no such plan, a kit info `Alert` says the same thing
 * without inventing a plan name.
 *
 * @module components/host/editor/CalendarSectionGate
 */

import type { JSX } from 'react';
import { Alert } from '@/components/account/ui/Alert';
import { LockedState } from '@/components/account/ui/LockedState';
import { Section } from '@/components/account/ui/Section';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CalendarSection } from './CalendarSection.client';
import { PlanEntitlementGate } from './PlanEntitlementGate.client';

/** The entitlement the calendar requires. */
export const CALENDAR_ENTITLEMENT = 'can_use_calendar';

/** Props of {@link CalendarSectionGate}. */
export interface CalendarSectionGateProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    /** Cheapest catalog plan granting the calendar, or null when none does. */
    readonly upsellPlanName: string | null;
    /** Where «Ver planes» goes. */
    readonly plansHref: string;
}

/**
 * What renders when the plan lacks the calendar.
 *
 * @param props - Locale, plan name and plans link.
 * @returns A `Section` holding the kit locked state.
 */
export function CalendarLockedSection({
    locale,
    upsellPlanName,
    plansHref
}: Omit<CalendarSectionGateProps, 'accommodationId'>): JSX.Element {
    const { t } = createTranslations(locale);
    const title = t('host.properties.editor.calendar.title', 'Calendario de ocupación');
    const description = t(
        'host.properties.editor.entitlement.calendarNudge',
        'Actualizá tu plan para usar el calendario de disponibilidad.'
    );
    return (
        <Section
            title={title}
            helpId={sectionHelpId({ vertical: 'accommodation', slug: 'calendario' })}
        >
            {upsellPlanName ? (
                <LockedState
                    locale={locale}
                    reason={{
                        kind: 'plan',
                        feature: title,
                        description,
                        plans: [{ name: upsellPlanName }],
                        plansHref
                    }}
                />
            ) : (
                <Alert
                    tone="info"
                    locale={locale}
                >
                    {description}
                </Alert>
            )}
        </Section>
    );
}

/**
 * The calendar behind its entitlement gate.
 *
 * @param props - See {@link CalendarSectionGateProps}.
 * @returns The calendar, or the locked section when the plan lacks it.
 */
export function CalendarSectionGate({
    locale,
    accommodationId,
    upsellPlanName,
    plansHref
}: CalendarSectionGateProps): JSX.Element {
    return (
        <PlanEntitlementGate
            entitlementKey={CALENDAR_ENTITLEMENT}
            locale={locale}
            upgradeUrl={plansHref}
            fallback={
                <CalendarLockedSection
                    locale={locale}
                    upsellPlanName={upsellPlanName}
                    plansHref={plansHref}
                />
            }
        >
            <CalendarSection
                locale={locale}
                accommodationId={accommodationId}
            />
        </PlanEntitlementGate>
    );
}
