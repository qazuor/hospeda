import type { TranslationKey } from '@repo/i18n';
import type { AddonVersionPublicationConfirmationSchema } from '@repo/schemas';
import { useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { usePublishAddonVersion } from './hooks/useAddonCatalog';
import {
    type CatalogAddon,
    type CatalogVersion,
    diffAddonVersion
} from './lib/addon-version-draft';

type Confirmation = z.infer<typeof AddonVersionPublicationConfirmationSchema>;

/** Shows the exact policy diff, anchored purchases and compare-and-swap publication. */
export function AddonVersionReview({
    addon,
    current,
    proposed,
    confirmation,
    onBack,
    onPublished
}: {
    addon: CatalogAddon;
    current: CatalogVersion;
    proposed: Pick<
        CatalogVersion,
        'entitlements' | 'limits' | 'scopeType' | 'validity' | 'validityDays'
    >;
    confirmation: Confirmation;
    onBack: () => void;
    onPublished: () => void;
}) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-billing.addonCatalogEditor.${key}` as TranslationKey, values);
    const publish = usePublishAddonVersion();
    const [error, setError] = useState<string | null>(null);
    const product = addon.product;
    if (!product) return null;
    const changes = diffAddonVersion({
        current,
        proposed,
        currentPrice: confirmation.current.price,
        proposedPrice: confirmation.proposed.price
    });
    const submit = async () => {
        setError(null);
        try {
            await publish.mutateAsync({
                productId: product.id,
                input: {
                    addonVersionId: confirmation.proposed.versionId,
                    price: confirmation.proposed.price,
                    expectedCurrentVersionId: confirmation.current.versionId,
                    expectedCurrentPrice: confirmation.current.price
                }
            });
            onPublished();
        } catch (reason) {
            setError(
                isApiError(reason)
                    ? tr('rejected', { message: reason.message })
                    : tr('genericError')
            );
        }
    };
    return (
        <section
            data-testid="addon-version-review"
            className="space-y-4 rounded-md border p-4"
        >
            <h3 className="font-semibold">{tr('reviewTitle')}</h3>
            <p>{tr('reviewIntro')}</p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className="p-2 text-left">{tr('changeKey')}</th>
                            <th className="p-2 text-left">{tr('changeKind')}</th>
                            <th className="p-2 text-left">{tr('changeFrom')}</th>
                            <th className="p-2 text-left">{tr('changeTo')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {changes.map((change) => (
                            <tr
                                key={change.key}
                                data-testid={`addon-version-change-${change.kind}-${change.key}`}
                            >
                                <td className="border-t p-2">{change.key}</td>
                                <td className="border-t p-2">{tr(`kinds.${change.kind}`)}</td>
                                <td className="border-t p-2">{change.from ?? tr('none')}</td>
                                <td className="border-t p-2">{change.to ?? tr('none')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {changes.length === 0 ? <p>{tr('noChanges')}</p> : null}
            <p>
                {tr('verticalsReadOnly', {
                    verticals: product.compatibleVerticals
                        .map((vertical) => tr(`verticalNames.${vertical}`))
                        .join(', ')
                })}
            </p>
            <p data-testid="addon-version-live-count">
                {tr('liveCount', { count: confirmation.liveInstancesOnCurrentVersion })}
            </p>
            <p data-testid="addon-version-anchored-note">{tr('anchoredNote')}</p>
            {error ? <p role="alert">{error}</p> : null}
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                >
                    {tr('back')}
                </Button>
                <Button
                    data-testid="addon-version-publish"
                    type="button"
                    disabled={publish.isPending}
                    onClick={() => void submit()}
                >
                    {tr('publish')}
                </Button>
            </div>
        </section>
    );
}
