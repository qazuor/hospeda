import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/settings/seo')({
    component: SeoSettingsPage
});

const SEO_SETTINGS_KEY = 'hospeda-admin-seo-settings';

type SeoSettings = {
    titleTemplate: string;
    defaultDescription: string;
    defaultOgImage: string;
};

const DEFAULT_SETTINGS: SeoSettings = {
    titleTemplate: '{page} | Hospeda',
    defaultDescription:
        'Descubre alojamientos, destinos y eventos en la región del Litoral argentino',
    defaultOgImage: ''
};

function getSeoSettings(): SeoSettings {
    try {
        const stored = localStorage.getItem(SEO_SETTINGS_KEY);
        return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
}

function saveSeoSettings(settings: SeoSettings): void {
    try {
        localStorage.setItem(SEO_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Silently fail if localStorage is not available
    }
}

function SeoSettingsPage() {
    const { t } = useTranslations();
    const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SETTINGS);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        setSettings(getSeoSettings());
    }, []);

    const handleChange = useCallback((field: keyof SeoSettings, value: string) => {
        setSettings((prev) => ({ ...prev, [field]: value }));
        setIsSaved(false);
    }, []);

    const handleSave = useCallback(() => {
        saveSeoSettings(settings);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    }, [settings]);

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.settingsSeo">
            <div className="max-w-3xl space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.systemSettings.seo.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.systemSettings.seo.subtitle')}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-pages.systemSettings.seo.metaDefaults')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="titleTemplate">
                                {t('admin-pages.systemSettings.seo.titleTemplate')}
                            </Label>
                            <Input
                                id="titleTemplate"
                                value={settings.titleTemplate}
                                onChange={(e) => handleChange('titleTemplate', e.target.value)}
                                placeholder={t(
                                    'admin-pages.systemSettings.seo.titleTemplatePlaceholder'
                                )}
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.systemSettings.seo.titleTemplateHint')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="defaultDescription">
                                {t('admin-pages.systemSettings.seo.defaultDescription')}
                            </Label>
                            <Textarea
                                id="defaultDescription"
                                value={settings.defaultDescription}
                                onChange={(e) => handleChange('defaultDescription', e.target.value)}
                                placeholder={t(
                                    'admin-pages.systemSettings.seo.defaultDescriptionPlaceholder'
                                )}
                                rows={3}
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.systemSettings.seo.defaultDescriptionHint')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="defaultOgImage">
                                {t('admin-pages.systemSettings.seo.defaultOgImage')}
                            </Label>
                            <Input
                                id="defaultOgImage"
                                value={settings.defaultOgImage}
                                onChange={(e) => handleChange('defaultOgImage', e.target.value)}
                                placeholder={t(
                                    'admin-pages.systemSettings.seo.defaultOgImagePlaceholder'
                                )}
                                type="url"
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.systemSettings.seo.defaultOgImageHint')}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-pages.systemSettings.seo.advancedSeo')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">
                                    {t('admin-pages.systemSettings.seo.sitemapGeneration')}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.systemSettings.seo.sitemapGenerationDesc')}
                                </p>
                            </div>
                            <Badge variant="outline">
                                {t('admin-pages.systemSettings.seo.sitemapEnabled')}
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">
                                    {t('admin-pages.systemSettings.seo.robotsTxt')}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.systemSettings.seo.robotsTxtDesc')}
                                </p>
                            </div>
                            <Badge variant="outline">
                                {t('admin-pages.systemSettings.seo.robotsConfigured')}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.systemSettings.seo.apiNote')}
                    </p>
                    <Button onClick={handleSave}>
                        {isSaved
                            ? t('admin-pages.systemSettings.seo.saved')
                            : t('admin-pages.systemSettings.seo.save')}
                    </Button>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
