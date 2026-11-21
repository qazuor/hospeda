/**
 * @file EmailPreviewsScreen.tsx
 * @description The admin email previewer screen (HOS-2519 §6.4, §8): the
 * catalog list on the left (top on mobile) and the preview pane on the right.
 * The first entry is selected on load. Rendered inside the route's permission
 * guard, so the queries never run for an admin without the permission.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useEmailPreviewList } from '@/hooks/use-email-previews';
import { useTranslations } from '@/hooks/use-translations';
import { EmailCatalogList } from './EmailCatalogList';
import { EmailPreviewPane } from './EmailPreviewPane';

/** The email previewer: catalog list plus preview pane. */
export function EmailPreviewsScreen() {
    const { t } = useTranslations();
    const { data, isLoading, isError, refetch } = useEmailPreviewList();
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    if (isLoading) {
        return (
            <p
                className="text-muted-foreground text-sm"
                aria-busy="true"
            >
                {t('admin-pages.emailPreviews.loading')}
            </p>
        );
    }

    if (isError || !data) {
        return (
            <div
                role="alert"
                className="flex flex-col items-start gap-2"
            >
                <p className="text-destructive text-sm">
                    {t('admin-pages.emailPreviews.loadError')}
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        void refetch();
                    }}
                >
                    {t('admin-pages.emailPreviews.retry')}
                </Button>
            </div>
        );
    }

    const entries = data.entries;
    const selected = entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? undefined;

    return (
        <div className="flex flex-col gap-6">
            <p className="text-muted-foreground text-sm">
                {t('admin-pages.emailPreviews.description')}
            </p>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:w-80 lg:overflow-y-auto">
                    <EmailCatalogList
                        entries={entries}
                        selectedKey={selected?.key ?? null}
                        onSelect={({ key }) => setSelectedKey(key)}
                    />
                </aside>
                <section className="min-w-0 flex-1">
                    {selected ? (
                        <EmailPreviewPane
                            key={selected.key}
                            entry={selected}
                        />
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.emailPreviews.selectPrompt')}
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}
