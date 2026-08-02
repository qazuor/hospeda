import { useEffect, useMemo, useState } from 'react';
import { TourController } from '@/components/account/TourController.client';
import { WhatsNewModal } from '@/components/account/WhatsNewModal.client';
import { getWelcomeTourForRoles } from '@/config/tours';
import { useTourState } from '@/hooks/use-tour-state';
import type { WhatsNewItem } from '@/hooks/use-whats-new';
import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';

interface DashboardControllerProps {
    readonly locale: SupportedLocale;
    /** Every role the user holds (`Astro.locals.user.roles`) — HOS-296. */
    readonly userRoles: readonly string[];
}

function hasUnseenHighlights(items: readonly WhatsNewItem[]): boolean {
    return items.some((item) => item.highlight && !item.seen);
}

export function DashboardController({ locale, userRoles }: DashboardControllerProps) {
    const { isLoading: tourLoading, hasSeen } = useTourState();
    const { items, isLoading: whatsNewLoading } = useWhatsNew();
    const [whatsNewModalOpen, setWhatsNewModalOpen] = useState(false);
    const [hasAutoOpenedWhatsNew, setHasAutoOpenedWhatsNew] = useState(false);

    const welcomeTourPending = useMemo(() => {
        const tour = getWelcomeTourForRoles({ roles: userRoles });
        if (!tour) return false;
        if (tourLoading) return true;
        return !hasSeen({ tourId: tour.id, version: tour.version });
    }, [userRoles, tourLoading, hasSeen]);

    const shouldShowWhatsNew = useMemo(() => {
        if (whatsNewLoading || welcomeTourPending) return false;
        return hasUnseenHighlights(items);
    }, [whatsNewLoading, welcomeTourPending, items]);

    useEffect(() => {
        if (shouldShowWhatsNew && !hasAutoOpenedWhatsNew) {
            setWhatsNewModalOpen(true);
            setHasAutoOpenedWhatsNew(true);
        }
    }, [shouldShowWhatsNew, hasAutoOpenedWhatsNew]);

    return (
        <>
            <TourController
                locale={locale}
                userRoles={userRoles}
            />

            <WhatsNewModal
                locale={locale}
                open={whatsNewModalOpen}
                onOpenChange={setWhatsNewModalOpen}
            />
        </>
    );
}
