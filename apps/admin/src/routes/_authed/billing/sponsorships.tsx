/**
 * Sponsorships Management Page
 *
 * Manages sponsorships, sponsorship levels, and sponsorship packages in a tabbed interface.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { SponsorshipLevelsTab } from './components/SponsorshipLevelsTab';
import { SponsorshipPackagesTab } from './components/SponsorshipPackagesTab';
import { SponsorshipsTab } from './components/SponsorshipsTab';

export const Route = createFileRoute('/_authed/billing/sponsorships')({
    component: BillingSponsorshipsPage
});

type TabId = 'sponsorships' | 'levels' | 'packages';

function BillingSponsorshipsPage() {
    const { t } = useTranslations();
    const [activeTab, setActiveTab] = useState<TabId>('sponsorships');

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-billing.sponsorships.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.sponsorships.description')}
                    </p>
                </div>

                {/* Tabs */}
                <div className="border-b">
                    <nav
                        className="flex gap-4"
                        role="tablist"
                    >
                        <TabButton
                            id="sponsorships"
                            label={t('admin-billing.sponsorships.tabs.sponsorships')}
                            isActive={activeTab === 'sponsorships'}
                            onClick={() => setActiveTab('sponsorships')}
                        />
                        <TabButton
                            id="levels"
                            label={t('admin-billing.sponsorships.tabs.levels')}
                            isActive={activeTab === 'levels'}
                            onClick={() => setActiveTab('levels')}
                        />
                        <TabButton
                            id="packages"
                            label={t('admin-billing.sponsorships.tabs.packages')}
                            isActive={activeTab === 'packages'}
                            onClick={() => setActiveTab('packages')}
                        />
                    </nav>
                </div>

                {/* Tab content */}
                <div>
                    {activeTab === 'sponsorships' && <SponsorshipsTab />}
                    {activeTab === 'levels' && <SponsorshipLevelsTab />}
                    {activeTab === 'packages' && <SponsorshipPackagesTab />}
                </div>
            </div>
        </SidebarPageLayout>
    );
}

interface TabButtonProps {
    readonly id: string;
    readonly label: string;
    readonly isActive: boolean;
    readonly onClick: () => void;
}

function TabButton({ id, label, isActive, onClick }: TabButtonProps) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            data-tab-id={id}
            onClick={onClick}
            className={`relative whitespace-nowrap px-1 py-3 font-medium text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            } after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:transition-colors ${
                isActive ? 'after:bg-primary' : 'after:bg-transparent hover:after:bg-border'
            }`}
        >
            {label}
        </button>
    );
}
