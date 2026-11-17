/**
 * @file HostTradeCategoriesScreen.tsx
 * @description The provider trade category catalog screen (HOS-919): one tab
 * per catalog. The route owns the permission guard; this component only lays
 * the tabs out.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from '@/hooks/use-translations';
import { catalogKey } from '../lib/i18n-keys';
import { HostTradeCategoryGroupsSection } from './HostTradeCategoryGroupsSection';

/**
 * Catalog screen with the groups tab.
 */
export function HostTradeCategoriesScreen() {
    const { t } = useTranslations();

    return (
        <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t(catalogKey({ path: 'subtitle' }))}</p>
            <Tabs defaultValue="groups">
                <TabsList>
                    <TabsTrigger value="groups">
                        {t(catalogKey({ path: 'tabs.groups' }))}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="groups">
                    <HostTradeCategoryGroupsSection />
                </TabsContent>
            </Tabs>
        </div>
    );
}
