/**
 * @file CatalogBasicFields.tsx
 * @description The fields groups and categories have in common (HOS-919):
 * slug, per-locale name, ordering weight and the active switch.
 *
 * Controlled and form-library agnostic: the dialogs mount it inside a
 * TanStack Form field, so one component serves both catalogs and the two
 * cannot drift apart on the slug rule (editable on create only, spec D8).
 */

import type { I18nText } from '@repo/schemas';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { I18nTextField } from '@/components/entity-form/fields/I18nTextField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';
import { catalogKey } from '../lib/i18n-keys';

/** Values the shared fields edit. `displayWeight` stays text until submit. */
export interface CatalogBasicValues {
    readonly slug: string;
    readonly nameI18n: I18nText;
    readonly displayWeight: string;
    readonly active: boolean;
}

/** Props for {@link CatalogBasicFields}. */
export interface CatalogBasicFieldsProps {
    /** Which catalog's copy to use. */
    readonly scope: 'groups' | 'categories';
    /** `create` unlocks the slug; `edit` locks it. */
    readonly mode: 'create' | 'edit';
    readonly value: CatalogBasicValues;
    readonly onChange: (next: CatalogBasicValues) => void;
    /** Translated validation messages keyed by field path. */
    readonly errors: Readonly<Record<string, string>>;
    readonly disabled?: boolean;
}

/**
 * Slug, name, weight and active switch for a catalog row.
 *
 * @param props - {@link CatalogBasicFieldsProps}
 */
export function CatalogBasicFields({
    scope,
    mode,
    value,
    onChange,
    errors,
    disabled = false
}: CatalogBasicFieldsProps) {
    const { t } = useTranslations();
    const testPrefix = scope === 'groups' ? 'group' : 'category';

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor={`${testPrefix}-slug`}>
                    {t(catalogKey({ path: `${scope}.dialog.slugLabel` }))}{' '}
                    <span className="text-destructive">*</span>
                </Label>
                <Input
                    id={`${testPrefix}-slug`}
                    data-testid={`${testPrefix}-slug`}
                    value={value.slug}
                    disabled={disabled || mode === 'edit'}
                    onChange={(e) => onChange({ ...value, slug: e.target.value })}
                    aria-invalid={Boolean(errors.slug)}
                    placeholder="plomeria"
                />
                <p className="text-muted-foreground text-xs">
                    {t(catalogKey({ path: `${scope}.dialog.slugHint` }))}
                </p>
                {errors.slug ? (
                    <p
                        className="text-destructive text-xs"
                        role="alert"
                    >
                        {errors.slug}
                    </p>
                ) : null}
            </div>

            <I18nTextField
                config={{
                    id: 'nameI18n',
                    type: FieldTypeEnum.I18N_TEXT,
                    label: t(catalogKey({ path: `${scope}.dialog.nameLabel` }))
                }}
                value={value.nameI18n}
                onChange={(nameI18n) => onChange({ ...value, nameI18n })}
                required
                disabled={disabled}
                hasError={Boolean(errors['nameI18n.es'] || errors.nameI18n)}
                localeErrors={{
                    es: errors['nameI18n.es'] ?? errors.nameI18n,
                    en: errors['nameI18n.en'],
                    pt: errors['nameI18n.pt']
                }}
            />

            <div className="space-y-1.5">
                <Label htmlFor={`${testPrefix}-weight`}>
                    {t(catalogKey({ path: `${scope}.dialog.weightLabel` }))}
                </Label>
                <Input
                    id={`${testPrefix}-weight`}
                    data-testid={`${testPrefix}-weight`}
                    type="number"
                    min={1}
                    max={1000}
                    value={value.displayWeight}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...value, displayWeight: e.target.value })}
                    aria-invalid={Boolean(errors.displayWeight)}
                />
                <p className="text-muted-foreground text-xs">
                    {t(catalogKey({ path: `${scope}.dialog.weightHint` }))}
                </p>
                {errors.displayWeight ? (
                    <p
                        className="text-destructive text-xs"
                        role="alert"
                    >
                        {errors.displayWeight}
                    </p>
                ) : null}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="space-y-0.5">
                    <Label htmlFor={`${testPrefix}-active`}>
                        {t(catalogKey({ path: `${scope}.dialog.activeLabel` }))}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                        {t(catalogKey({ path: `${scope}.dialog.activeHint` }))}
                    </p>
                </div>
                <Switch
                    id={`${testPrefix}-active`}
                    data-testid={`${testPrefix}-active`}
                    checked={value.active}
                    disabled={disabled}
                    onCheckedChange={(active) => onChange({ ...value, active })}
                />
            </div>
        </div>
    );
}
