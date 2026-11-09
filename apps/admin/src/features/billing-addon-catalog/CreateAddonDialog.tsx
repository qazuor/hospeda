import type { TranslationKey } from '@repo/i18n';
import {
    AddonVersionContentSchema,
    CreateAddonProductRequestSchema,
    CreateAddonRequestSchema,
    VerticalEnum
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { AddonVersionFields } from './AddonVersionFields';
import { useCreateAddon, useCreateAddonProduct } from './hooks/useAddonCatalog';
import { toAddonVersionContent, toAddonVersionDraft } from './lib/addon-version-draft';

type CreateValues = {
    slug: string;
    name: string;
    description: string;
    version: ReturnType<typeof toAddonVersionDraft>;
    chargeKind: 'PERIODICO' | 'UNA_VEZ';
    cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
    verticals: VerticalEnum[];
};

/** Creates addon identity, first version and product with a resumable second step. */
export function CreateAddonDialog({
    open,
    onOpenChange,
    onCreated
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
}) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-billing.addonCatalogEditor.${key}` as TranslationKey, values);
    const createAddon = useCreateAddon();
    const createProduct = useCreateAddonProduct();
    const [created, setCreated] = useState<{ addonId: string; versionId: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const form = useForm<CreateValues>({
        defaultValues: {
            slug: '',
            name: '',
            description: '',
            version: toAddonVersionDraft({ version: null, price: null }),
            chargeKind: 'PERIODICO',
            cycle: 'monthly',
            verticals: [VerticalEnum.ACCOMMODATION]
        },
        onSubmit: async ({ value }) => {
            setError(null);
            const version = AddonVersionContentSchema.safeParse(
                toAddonVersionContent({ draft: value.version })
            );
            const price = Number(value.version.price);
            if (
                !version.success ||
                !value.version.price.trim() ||
                !Number.isInteger(price) ||
                price <= 0
            ) {
                setError(tr('invalid'));
                return;
            }
            const addon = CreateAddonRequestSchema.safeParse({
                slug: value.slug.trim(),
                name: value.name.trim(),
                description: value.description.trim() || null,
                firstVersion: version.data
            });
            if (!addon.success) {
                setError(tr('invalid'));
                return;
            }
            const productDraft = {
                addonId: created?.addonId ?? '00000000-0000-4000-8000-000000000000',
                versionId: created?.versionId ?? '00000000-0000-4000-8000-000000000000',
                price,
                chargeKind: value.chargeKind,
                cycle: value.chargeKind === 'PERIODICO' ? value.cycle : null,
                compatibleVerticals: value.verticals
            };
            if (!CreateAddonProductRequestSchema.safeParse(productDraft).success) {
                setError(tr('invalid'));
                return;
            }
            let productAttempted = false;
            try {
                const ids =
                    created ??
                    (await createAddon.mutateAsync(addon.data).then((result) => ({
                        addonId: result.addon.id,
                        versionId: result.version.id
                    })));
                if (!created) setCreated(ids);
                productAttempted = true;
                await createProduct.mutateAsync({ ...productDraft, ...ids });
                setCreated(null);
                form.reset();
                onCreated();
                onOpenChange(false);
            } catch (reason) {
                setError(
                    productAttempted
                        ? tr('productFailed')
                        : isApiError(reason)
                          ? tr('rejected', { message: reason.message })
                          : tr('genericError')
                );
            }
        }
    });
    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{tr('createTitle')}</DialogTitle>
                    <DialogDescription>{tr('createIntro')}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void form.handleSubmit();
                    }}
                >
                    {created ? (
                        <p role="status">{tr('productRetry', { versionId: created.versionId })}</p>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <form.Field name="slug">
                            {(field) => (
                                <label className="space-y-1 text-sm">
                                    {tr('slug')}
                                    <input
                                        className="h-10 w-full rounded-md border bg-background px-3"
                                        disabled={!!created}
                                        value={field.state.value}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                </label>
                            )}
                        </form.Field>
                        <form.Field name="name">
                            {(field) => (
                                <label className="space-y-1 text-sm">
                                    {tr('name')}
                                    <input
                                        className="h-10 w-full rounded-md border bg-background px-3"
                                        disabled={!!created}
                                        value={field.state.value}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                </label>
                            )}
                        </form.Field>
                    </div>
                    <form.Field name="description">
                        {(field) => (
                            <label className="block space-y-1 text-sm">
                                {tr('description')}
                                <textarea
                                    className="w-full rounded-md border bg-background p-3"
                                    disabled={!!created}
                                    value={field.state.value}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                />
                            </label>
                        )}
                    </form.Field>
                    <form.Subscribe selector={(state) => state.values.version}>
                        {(draft) => (
                            <div className={created ? 'pointer-events-none opacity-60' : ''}>
                                <AddonVersionFields
                                    draft={draft}
                                    onChange={(next) => form.setFieldValue('version', next)}
                                    disabled={!!created}
                                />
                            </div>
                        )}
                    </form.Subscribe>
                    <form.Subscribe selector={(state) => state.values.version.price}>
                        {(price) => (
                            <label className="block space-y-1 text-sm">
                                {tr('price')}
                                <input
                                    className="h-10 w-full rounded-md border bg-background px-3"
                                    type="number"
                                    min="1"
                                    value={price}
                                    onChange={(event) =>
                                        form.setFieldValue('version', {
                                            ...form.state.values.version,
                                            price: event.target.value
                                        })
                                    }
                                />
                            </label>
                        )}
                    </form.Subscribe>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <form.Field name="chargeKind">
                            {(field) => (
                                <label className="space-y-1 text-sm">
                                    {tr('chargeKind')}
                                    <select
                                        className="h-10 w-full rounded-md border bg-background px-3"
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(
                                                event.target.value as CreateValues['chargeKind']
                                            )
                                        }
                                    >
                                        <option value="PERIODICO">{tr('recurring')}</option>
                                        <option value="UNA_VEZ">{tr('oneTime')}</option>
                                    </select>
                                </label>
                            )}
                        </form.Field>
                        <form.Subscribe selector={(state) => state.values.chargeKind}>
                            {(chargeKind) =>
                                chargeKind === 'UNA_VEZ' ? (
                                    <p className="text-sm">{tr('oneTimeWebNote')}</p>
                                ) : (
                                    <form.Field name="cycle">
                                        {(field) => (
                                            <label className="space-y-1 text-sm">
                                                {tr('cycle')}
                                                <select
                                                    className="h-10 w-full rounded-md border bg-background px-3"
                                                    value={field.state.value}
                                                    onChange={(event) =>
                                                        field.handleChange(
                                                            event.target
                                                                .value as CreateValues['cycle']
                                                        )
                                                    }
                                                >
                                                    {(
                                                        [
                                                            'monthly',
                                                            'quarterly',
                                                            'semiannual',
                                                            'annual'
                                                        ] as const
                                                    ).map((cycle) => (
                                                        <option
                                                            key={cycle}
                                                            value={cycle}
                                                        >
                                                            {tr(`cycles.${cycle}`)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                    </form.Field>
                                )
                            }
                        </form.Subscribe>
                    </div>
                    <fieldset className="rounded-md border p-3">
                        <legend>{tr('verticals')}</legend>
                        <form.Subscribe selector={(state) => state.values.verticals}>
                            {(verticals) => (
                                <div className="flex flex-wrap gap-3">
                                    {Object.values(VerticalEnum).map((vertical) => (
                                        <label
                                            key={vertical}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={verticals.includes(vertical)}
                                                onChange={(event) =>
                                                    form.setFieldValue(
                                                        'verticals',
                                                        event.target.checked
                                                            ? [...verticals, vertical]
                                                            : verticals.filter(
                                                                  (value) => value !== vertical
                                                              )
                                                    )
                                                }
                                            />
                                            {tr(`verticalNames.${vertical}`)}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </form.Subscribe>
                    </fieldset>
                    {error ? <p role="alert">{error}</p> : null}
                    <Button
                        data-testid="addon-create-submit"
                        type="submit"
                        disabled={createAddon.isPending || createProduct.isPending}
                    >
                        {created ? tr('retryProduct') : tr('create')}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
