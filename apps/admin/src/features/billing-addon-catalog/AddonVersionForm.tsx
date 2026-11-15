import type { TranslationKey } from '@repo/i18n';
import {
    AddonVersionContentSchema,
    type AddonVersionPublicationConfirmationSchema
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { AddonVersionFields } from './AddonVersionFields';
import { AddonVersionReview } from './AddonVersionReview';
import { useCreateAddonVersion, usePreviewAddonVersion } from './hooks/useAddonCatalog';
import {
    type CatalogAddon,
    toAddonVersionContent,
    toAddonVersionDraft
} from './lib/addon-version-draft';

const RejectionSchema = z.object({ error: z.object({ reason: z.string().optional() }) });

/** Creates an immutable version, previews it and keeps the same version on retry. */
export function AddonVersionForm({
    addon,
    onCancel,
    onPublished
}: {
    addon: CatalogAddon;
    onCancel: () => void;
    onPublished: () => void;
}) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-billing.addonCatalogEditor.${key}` as TranslationKey, values);
    const product = addon.product;
    const current = addon.versions.find((version) => version.id === product?.versionId);
    const create = useCreateAddonVersion();
    const preview = usePreviewAddonVersion();
    const [createdVersionId, setCreatedVersionId] = useState<string | null>(null);
    const [review, setReview] = useState<{
        confirmation: z.infer<typeof AddonVersionPublicationConfirmationSchema>;
        proposed: NonNullable<typeof current>;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const form = useForm({
        defaultValues: toAddonVersionDraft({
            version: current ?? null,
            price: product?.price ?? null
        }),
        onSubmit: async ({ value }) => {
            if (!product || !current) return;
            setError(null);
            const content = AddonVersionContentSchema.safeParse(
                toAddonVersionContent({ draft: value })
            );
            const price = Number(value.price);
            if (!content.success || !value.price.trim() || !Number.isInteger(price) || price <= 0) {
                setError(tr('invalid'));
                return;
            }
            try {
                const versionId =
                    createdVersionId ??
                    (await create.mutateAsync({ addonId: addon.id, content: content.data })).id;
                if (!createdVersionId) setCreatedVersionId(versionId);
                const confirmation = await preview.mutateAsync({
                    productId: product.id,
                    input: { addonVersionId: versionId, price }
                });
                setReview({
                    confirmation,
                    proposed: { ...current, ...content.data, id: versionId }
                });
            } catch (reason) {
                const rejection = isApiError(reason)
                    ? RejectionSchema.safeParse(reason.body)
                    : null;
                const liveConflict =
                    rejection?.success &&
                    rejection.data.error.reason === 'ADDON_PRODUCT_HAS_LIVE_INSTANCES';
                setError(
                    liveConflict
                        ? tr('livePriceConflict', { count: current.liveInstances })
                        : isApiError(reason)
                          ? tr('rejected', { message: reason.message })
                          : tr('genericError')
                );
            }
        }
    });
    if (!product || !current) return <p>{tr('noProduct')}</p>;
    return (
        <section className="space-y-4 rounded-md border p-4">
            <h3 className="font-semibold">{tr('newVersionTitle', { name: addon.name })}</h3>
            {review ? (
                <AddonVersionReview
                    addon={addon}
                    current={current}
                    proposed={review.proposed}
                    confirmation={review.confirmation}
                    onBack={() => setReview(null)}
                    onPublished={onPublished}
                />
            ) : (
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void form.handleSubmit();
                    }}
                >
                    {createdVersionId ? (
                        <p role="status">{tr('versionRetry', { versionId: createdVersionId })}</p>
                    ) : null}
                    <div className={createdVersionId ? 'pointer-events-none opacity-60' : ''}>
                        <form.Subscribe selector={(state) => state.values}>
                            {(draft) => (
                                <AddonVersionFields
                                    draft={draft}
                                    disabled={!!createdVersionId}
                                    onChange={(next) => {
                                        form.setFieldValue('validity', next.validity);
                                        form.setFieldValue('validityDays', next.validityDays);
                                        form.setFieldValue('scopeType', next.scopeType);
                                        form.setFieldValue('entitlements', next.entitlements);
                                        form.setFieldValue('limits', next.limits);
                                    }}
                                />
                            )}
                        </form.Subscribe>
                    </div>
                    <form.Field name="price">
                        {(field) => (
                            <label className="block space-y-1 text-sm">
                                {tr('price')}
                                <input
                                    className="h-10 w-full rounded-md border bg-background px-3"
                                    type="number"
                                    min="1"
                                    value={field.state.value}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                />
                            </label>
                        )}
                    </form.Field>
                    <p>
                        {tr('verticalsReadOnly', {
                            verticals: product.compatibleVerticals
                                .map((vertical) => tr(`verticalNames.${vertical}`))
                                .join(', ')
                        })}
                    </p>
                    {error ? <p role="alert">{error}</p> : null}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                        >
                            {tr('back')}
                        </Button>
                        <Button
                            data-testid="addon-version-preview"
                            type="submit"
                            disabled={create.isPending || preview.isPending}
                        >
                            {tr('preview')}
                        </Button>
                    </div>
                </form>
            )}
        </section>
    );
}
