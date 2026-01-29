import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
                    <h2 className="mb-2 font-bold text-2xl">SEO Configuration</h2>
                    <p className="text-muted-foreground">
                        Manage default SEO settings for the public website
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Meta Defaults</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="titleTemplate">Title Template</Label>
                            <Input
                                id="titleTemplate"
                                value={settings.titleTemplate}
                                onChange={(e) => handleChange('titleTemplate', e.target.value)}
                                placeholder="{page} | Hospeda"
                            />
                            <p className="text-muted-foreground text-xs">
                                Use {'{page}'} as placeholder for page name
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="defaultDescription">Default Meta Description</Label>
                            <Textarea
                                id="defaultDescription"
                                value={settings.defaultDescription}
                                onChange={(e) => handleChange('defaultDescription', e.target.value)}
                                placeholder="Default site description..."
                                rows={3}
                            />
                            <p className="text-muted-foreground text-xs">
                                Used when a page doesn&apos;t have a specific description
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="defaultOgImage">Default OG Image URL</Label>
                            <Input
                                id="defaultOgImage"
                                value={settings.defaultOgImage}
                                onChange={(e) => handleChange('defaultOgImage', e.target.value)}
                                placeholder="https://example.com/og-image.jpg"
                                type="url"
                            />
                            <p className="text-muted-foreground text-xs">
                                Default Open Graph image for social sharing
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Advanced SEO</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Sitemap Generation</p>
                                <p className="text-muted-foreground text-sm">
                                    Automatically generated at /sitemap.xml
                                </p>
                            </div>
                            <Badge variant="outline">Enabled</Badge>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Robots.txt</p>
                                <p className="text-muted-foreground text-sm">
                                    Search engine crawling configuration
                                </p>
                            </div>
                            <Badge variant="outline">Configured</Badge>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                        Note: These settings will be connected to the API in a future update
                    </p>
                    <Button onClick={handleSave}>{isSaved ? 'Saved' : 'Save Changes'}</Button>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
