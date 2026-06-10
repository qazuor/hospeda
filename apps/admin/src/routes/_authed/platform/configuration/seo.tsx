import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    legacyAdapters,
    usePlatformSetting,
    useUpdatePlatformSetting
} from '@/hooks/use-platform-setting';
import { useTranslations } from '@/hooks/use-translations';
import { requireAdminApiAccess } from '@/lib/admin-api-access';
import { type SeoDefaultsValue, SeoDefaultsValueSchema } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/platform/configuration/seo')({
    beforeLoad: ({ context }) => requireAdminApiAccess(context),
    component: SeoSettingsPage
});

const DEFAULT_SETTINGS: SeoDefaultsValue = {
    metaTitleTemplate: '{page} | Hospeda',
    metaDescriptionDefault:
        'Descubre alojamientos, destinos y eventos en la región del Litoral argentino',
    ogImageDefault: 'https://hospeda.com.ar/og-default.png'
};

function SeoSettingsPage() {
    const { t } = useTranslations();
    const [settings, setSettings] = useState<SeoDefaultsValue>(DEFAULT_SETTINGS);
    const [validationError, setValidationError] = useState<string | null>(null);

    const seoQuery = usePlatformSetting({
        key: 'seo.defaults',
        legacyAdapter: legacyAdapters.seoDefaults
    });
    const seoMutation = useUpdatePlatformSetting({
        key: 'seo.defaults',
        legacyAdapter: legacyAdapters.seoDefaults
    });

    // Seed the form once with whichever value the query resolves: API row
    // wins; legacy localStorage value is the fallback; defaults if neither.
    useEffect(() => {
        if (!seoQuery.data) return;
        const incoming = seoQuery.data.row?.value ?? seoQuery.data.legacyValue ?? DEFAULT_SETTINGS;
        setSettings(incoming);
    }, [seoQuery.data]);

    const handleChange = (field: keyof SeoDefaultsValue, value: string): void => {
        setSettings((prev) => ({ ...prev, [field]: value }));
        if (validationError !== null) setValidationError(null);
        if (seoMutation.isSuccess) seoMutation.reset();
    };

    const handleSave = (): void => {
        const parsed = SeoDefaultsValueSchema.safeParse(settings);
        if (!parsed.success) {
            setValidationError(parsed.error.issues[0]?.message ?? 'Validation error');
            return;
        }
        seoMutation.mutate(parsed.data);
    };

    const isSaved = seoMutation.isSuccess;
    const isSaving = seoMutation.isPending;

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
                            <Label htmlFor="metaTitleTemplate">
                                {t('admin-pages.systemSettings.seo.titleTemplate')}
                            </Label>
                            <Input
                                id="metaTitleTemplate"
                                value={settings.metaTitleTemplate}
                                onChange={(e) => handleChange('metaTitleTemplate', e.target.value)}
                                placeholder={t(
                                    'admin-pages.systemSettings.seo.titleTemplatePlaceholder'
                                )}
                                disabled={isSaving}
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.systemSettings.seo.titleTemplateHint')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="metaDescriptionDefault">
                                {t('admin-pages.systemSettings.seo.defaultDescription')}
                            </Label>
                            <Textarea
                                id="metaDescriptionDefault"
                                value={settings.metaDescriptionDefault}
                                onChange={(e) =>
                                    handleChange('metaDescriptionDefault', e.target.value)
                                }
                                placeholder={t(
                                    'admin-pages.systemSettings.seo.defaultDescriptionPlaceholder'
                                )}
                                rows={3}
                                disabled={isSaving}
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-pages.systemSettings.seo.defaultDescriptionHint')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ogImageDefault">
                                {t('admin-pages.systemSettings.seo.defaultOgImage')}
                            </Label>
                            <Input
                                id="ogImageDefault"
                                value={settings.ogImageDefault}
                                onChange={(e) => handleChange('ogImageDefault', e.target.value)}
                                placeholder={t(
                                    'admin-pages.systemSettings.seo.defaultOgImagePlaceholder'
                                )}
                                type="url"
                                disabled={isSaving}
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

                <div className="flex flex-col items-end gap-2">
                    <div className="flex w-full items-center justify-between">
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.systemSettings.seo.apiNote')}
                        </p>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving
                                ? t('admin-pages.systemSettings.seo.save')
                                : isSaved
                                  ? t('admin-pages.systemSettings.seo.saved')
                                  : t('admin-pages.systemSettings.seo.save')}
                        </Button>
                    </div>
                    {validationError && (
                        <p className="text-destructive text-xs">{validationError}</p>
                    )}
                    {seoMutation.isError && (
                        <p className="text-destructive text-xs">
                            {seoMutation.error instanceof Error
                                ? seoMutation.error.message
                                : String(seoMutation.error)}
                        </p>
                    )}
                </div>
            </div>
        </SidebarPageLayout>
    );
}
