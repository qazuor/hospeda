import type { TranslationKey } from '@repo/i18n';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { AddonVersionForm } from './AddonVersionForm';
import { CreateAddonDialog } from './CreateAddonDialog';
import { useAddonCatalog } from './hooks/useAddonCatalog';

/** Lists the action 20 catalog and composes creation and publication in one screen. */
export function AddonCatalogScreen() {
    const { t } = useTranslations();
    const tr = (key: string) => t(`admin-billing.addonCatalogEditor.${key}` as TranslationKey);
    const catalog = useAddonCatalog();
    const [createOpen, setCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    return (
        <section
            data-testid="addon-catalog-screen"
            className="space-y-5"
        >
            <p>{tr('intro')}</p>
            <Button
                data-testid="addon-catalog-create"
                type="button"
                onClick={() => {
                    setSuccess(false);
                    setCreateOpen(true);
                }}
            >
                {tr('create')}
            </Button>
            {success ? (
                <p
                    data-testid="addon-version-published"
                    role="status"
                >
                    {tr('published')}
                </p>
            ) : null}
            {catalog.isLoading ? <p role="status">{tr('loading')}</p> : null}
            {catalog.isError ? (
                <p role="alert">
                    {isApiError(catalog.error) && catalog.error.status === 403
                        ? tr('forbidden')
                        : tr('loadError')}
                </p>
            ) : null}
            {catalog.data?.items.length === 0 ? <p>{tr('empty')}</p> : null}
            {catalog.data?.items.map((addon) => (
                <article
                    key={addon.id}
                    data-testid={`addon-catalog-row-${addon.id}`}
                    className="space-y-3 rounded-md border p-4"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="font-semibold">{addon.name}</h2>
                            <p className="text-muted-foreground text-sm">{addon.slug}</p>
                        </div>
                        {addon.product ? (
                            <Button
                                data-testid={`addon-version-new-${addon.id}`}
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSuccess(false);
                                    setEditingId(addon.id);
                                }}
                            >
                                {tr('newVersion')}
                            </Button>
                        ) : null}
                    </div>
                    {addon.product ? (
                        <p className="text-sm">
                            {tr('currentVersion')}: {addon.product.versionId} · {tr('price')}:{' '}
                            {addon.product.price} ARS ·{' '}
                            {tr(addon.product.chargeKind === 'PERIODICO' ? 'recurring' : 'oneTime')}
                        </p>
                    ) : (
                        <p>{tr('noProduct')}</p>
                    )}
                    {editingId === addon.id ? (
                        <AddonVersionForm
                            addon={addon}
                            onCancel={() => setEditingId(null)}
                            onPublished={() => {
                                setEditingId(null);
                                setSuccess(true);
                            }}
                        />
                    ) : null}
                </article>
            ))}
            <CreateAddonDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={() => setSuccess(true)}
            />
        </section>
    );
}
