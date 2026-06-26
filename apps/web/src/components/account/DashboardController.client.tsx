import { TourController } from '@/components/account/TourController.client';
import { WhatsNewModal } from '@/components/account/WhatsNewModal.client';
import { getWelcomeTourForRole } from '@/config/tours';
import { useTourState } from '@/hooks/use-tour-state';
import type { WhatsNewItem } from '@/hooks/use-whats-new';
import { useWhatsNew } from '@/hooks/use-whats-new';
import type { SupportedLocale } from '@/lib/i18n';
import { useEffect, useMemo, useState } from 'react';

interface DashboardControllerProps {
    readonly locale: SupportedLocale;
    readonly userRole: string | null;
}

function hasUnseenHighlights(items: readonly WhatsNewItem[]): boolean {
    return items.some((item) => item.highlight && !item.seen);
}

export function DashboardController({ locale, userRole }: DashboardControllerProps) {
    const { isLoading: tourLoading, hasSeen } = useTourState();
    const { items, isLoading: whatsNewLoading } = useWhatsNew();
    const [whatsNewModalOpen, setWhatsNewModalOpen] = useState(false);
    const [hasAutoOpenedWhatsNew, setHasAutoOpenedWhatsNew] = useState(false);

    const welcomeTourPending = useMemo(() => {
        const tour = getWelcomeTourForRole(userRole);
        if (!tour) return false;
        if (tourLoading) return true;
        return !hasSeen({ tourId: tour.id, version: tour.version });
    }, [userRole, tourLoading, hasSeen]);

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
                userRole={userRole}
            />

            <WhatsNewModal
                locale={locale}
                open={whatsNewModalOpen}
                onOpenChange={setWhatsNewModalOpen}
            />
        </>
    );
}
