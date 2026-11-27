import {
    applyDynamicBlockDefaults,
    DYNAMIC_SOURCES_BY_ENTITY_TYPE,
    DynamicBlockConfigSchema,
    ENABLED_DYNAMIC_ENTITY_TYPES,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum,
    NewsletterIfBelowMinEnum
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useEffect, useState } from 'react';
import { DestinationSelect } from '@/components/selects/DestinationSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import type { DynamicBlockEditInput } from './dynamic-block.extension';

/** Configuration form for an existing atomic newsletter block. */
export function DynamicBlockConfigPanel({
    selection,
    dynamicBlockCount,
    onSave
}: {
    readonly selection: DynamicBlockEditInput;
    readonly dynamicBlockCount: number;
    readonly onSave: (input: DynamicBlockEditInput) => void;
}) {
    const { t } = useTranslations();
    const [manual, setManual] = useState(selection.ifBelowMinManual);
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
    const form = useForm({
        defaultValues: selection.config,
        onSubmit: ({ value }) => {
            const result = DynamicBlockConfigSchema.safeParse(value);
            if (!result.success) {
                setErrors(
                    Object.fromEntries(
                        result.error.issues.map((issue) => [
                            issue.path.join('.'),
                            t('admin-newsletter.dynamicBlock.invalidField')
                        ])
                    )
                );
                return;
            }
            setErrors({});
            onSave({ blockKey: selection.blockKey, config: result.data, ifBelowMinManual: manual });
        }
    });
    useEffect(() => {
        if (manual) return;
        const defaults = applyDynamicBlockDefaults({
            config: selection.config,
            dynamicBlockCount: Math.max(1, dynamicBlockCount)
        });
        form.setFieldValue('ifBelowMin', defaults.ifBelowMin);
    }, [dynamicBlockCount, manual, selection, form]);

    const error = (name: string) =>
        errors[name] ? (
            <p
                id={`error-${name}`}
                role="alert"
                className="text-destructive text-sm"
            >
                {errors[name]}
            </p>
        ) : null;

    return (
        <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
            }}
        >
            <form.Field name="entityType">
                {(field) => (
                    <div>
                        <label htmlFor="dynamic-entity">
                            {t('admin-newsletter.dynamicBlock.entityType')}
                        </label>
                        <Select
                            value={field.state.value}
                            onValueChange={(value) =>
                                field.handleChange(value as NewsletterDynamicEntityTypeEnum)
                            }
                        >
                            <SelectTrigger id="dynamic-entity">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(NewsletterDynamicEntityTypeEnum).map((type) => (
                                    <SelectItem
                                        key={type}
                                        value={type}
                                        disabled={!ENABLED_DYNAMIC_ENTITY_TYPES.includes(type)}
                                    >
                                        {t(`admin-newsletter.dynamicBlock.entities.${type}`)}
                                        {!ENABLED_DYNAMIC_ENTITY_TYPES.includes(type) && (
                                            <Badge
                                                variant="secondary"
                                                className="ml-2"
                                            >
                                                {t('admin-newsletter.dynamicBlock.comingSoon')}
                                            </Badge>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {error('entityType')}
                    </div>
                )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.entityType}>
                {(entityType) => (
                    <form.Field name="source">
                        {(field) => (
                            <div>
                                <label htmlFor="dynamic-source">
                                    {t('admin-newsletter.dynamicBlock.source')}
                                </label>
                                <select
                                    id="dynamic-source"
                                    className="w-full rounded-md border bg-background p-2"
                                    value={field.state.value}
                                    onChange={(event) => {
                                        const source = event.target
                                            .value as NewsletterDynamicSourceEnum;
                                        const defaults = applyDynamicBlockDefaults({
                                            config: {
                                                blockKey: selection.blockKey,
                                                entityType,
                                                source,
                                                count: 4,
                                                params: {
                                                    destinationId:
                                                        form.state.values.params.destinationId
                                                },
                                                ifBelowMin: form.state.values.ifBelowMin
                                            },
                                            dynamicBlockCount: Math.max(1, dynamicBlockCount),
                                            ifBelowMinManuallyChanged: manual
                                        });
                                        field.handleChange(source);
                                        form.setFieldValue('params', defaults.params);
                                        form.setFieldValue(
                                            'excludeRecentEditions',
                                            defaults.excludeRecentEditions
                                        );
                                        form.setFieldValue(
                                            'fillWithRepeats',
                                            defaults.fillWithRepeats
                                        );
                                        form.setFieldValue('ifBelowMin', defaults.ifBelowMin);
                                    }}
                                >
                                    {DYNAMIC_SOURCES_BY_ENTITY_TYPE[entityType].map((source) => (
                                        <option
                                            key={source}
                                            value={source}
                                            disabled={
                                                source === NewsletterDynamicSourceEnum.FEATURED
                                            }
                                        >
                                            {t(`admin-newsletter.dynamicBlock.sources.${source}`)}
                                            {source === NewsletterDynamicSourceEnum.FEATURED
                                                ? ` — ${t('admin-newsletter.dynamicBlock.comingSoon')}`
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                                {error('source')}
                            </div>
                        )}
                    </form.Field>
                )}
            </form.Subscribe>
            {(['count', 'minItems', 'excludeRecentEditions'] as const).map((name) => (
                <form.Field
                    key={name}
                    name={name}
                >
                    {(field) => (
                        <div>
                            <label htmlFor={`dynamic-${name}`}>
                                {t(`admin-newsletter.dynamicBlock.${name}`)}
                            </label>
                            <Input
                                id={`dynamic-${name}`}
                                type="number"
                                value={field.state.value}
                                aria-invalid={!!errors[name]}
                                aria-describedby={errors[name] ? `error-${name}` : undefined}
                                onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                            />
                            {error(name)}
                        </div>
                    )}
                </form.Field>
            ))}
            <form.Field name="ifBelowMin">
                {(field) => (
                    <div>
                        <label htmlFor="dynamic-policy">
                            {t('admin-newsletter.dynamicBlock.ifBelowMin')}
                        </label>
                        <select
                            id="dynamic-policy"
                            className="w-full rounded-md border bg-background p-2"
                            value={field.state.value}
                            onChange={(event) => {
                                setManual(true);
                                field.handleChange(event.target.value as NewsletterIfBelowMinEnum);
                            }}
                        >
                            {Object.values(NewsletterIfBelowMinEnum).map((policy) => (
                                <option
                                    key={policy}
                                    value={policy}
                                >
                                    {t(`admin-newsletter.dynamicBlock.actions.${policy}`)}
                                </option>
                            ))}
                        </select>
                        {error('ifBelowMin')}
                    </div>
                )}
            </form.Field>
            <form.Field name="params.destinationId">
                {(field) => (
                    <fieldset>
                        <legend>{t('admin-newsletter.dynamicBlock.destination')}</legend>
                        <DestinationSelect
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value || undefined)}
                            error={errors['params.destinationId']}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => field.handleChange(undefined)}
                        >
                            {t('admin-newsletter.dynamicBlock.allDestinations')}
                        </Button>
                    </fieldset>
                )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.source}>
                {(source) => {
                    const name =
                        source === NewsletterDynamicSourceEnum.MOST_VIEWED
                            ? 'params.windowDays'
                            : source === NewsletterDynamicSourceEnum.TOP_RATED
                              ? 'params.minReviews'
                              : null;
                    return (
                        name && (
                            <form.Field
                                key={name}
                                name={name}
                            >
                                {(field) => (
                                    <div>
                                        <label htmlFor={name}>
                                            {t(
                                                `admin-newsletter.dynamicBlock.${name === 'params.windowDays' ? 'windowDays' : 'minReviews'}`
                                            )}
                                        </label>
                                        <Input
                                            id={name}
                                            type="number"
                                            value={field.state.value ?? ''}
                                            aria-invalid={!!errors[name]}
                                            onChange={(event) =>
                                                field.handleChange(event.target.valueAsNumber)
                                            }
                                        />
                                        {error(name)}
                                    </div>
                                )}
                            </form.Field>
                        )
                    );
                }}
            </form.Subscribe>
            <form.Field name="fillWithRepeats">
                {(field) => (
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={field.state.value}
                            onChange={(event) => field.handleChange(event.target.checked)}
                        />
                        {t('admin-newsletter.dynamicBlock.fillWithRepeats')}
                    </label>
                )}
            </form.Field>
            <Button type="submit">{t('admin-newsletter.dynamicBlock.save')}</Button>
        </form>
    );
}
