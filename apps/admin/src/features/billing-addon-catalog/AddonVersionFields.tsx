import type { TranslationKey } from '@repo/i18n';
import { useId, useRef } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import type { AddonVersionDraft } from './lib/addon-version-draft';

/** Shared editable policy fields for first and subsequent addon versions. */
export function AddonVersionFields({
    draft,
    onChange,
    disabled = false
}: {
    draft: AddonVersionDraft;
    onChange: (draft: AddonVersionDraft) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslations();
    const tr = (key: string) => t(`admin-billing.addonCatalogEditor.${key}` as TranslationKey);
    const prefix = useId();
    const nextId = useRef(0);
    const entitlementIds = useRef<string[]>([]);
    const limitIds = useRef<string[]>([]);
    while (entitlementIds.current.length < draft.entitlements.length)
        entitlementIds.current.push(`${prefix}-entitlement-${nextId.current++}`);
    while (limitIds.current.length < draft.limits.length)
        limitIds.current.push(`${prefix}-limit-${nextId.current++}`);
    return (
        <fieldset
            disabled={disabled}
            className="space-y-3 rounded-md border p-3 disabled:opacity-60"
        >
            <legend>{tr('versionTitle')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                    {tr('scope')}
                    <select
                        className="h-10 w-full rounded-md border bg-background px-3"
                        value={draft.scopeType}
                        onChange={(event) =>
                            onChange({
                                ...draft,
                                scopeType: event.target.value as AddonVersionDraft['scopeType']
                            })
                        }
                    >
                        {(['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL'] as const).map(
                            (value) => (
                                <option
                                    key={value}
                                    value={value}
                                >
                                    {tr(`scopes.${value}`)}
                                </option>
                            )
                        )}
                    </select>
                </label>
                <label className="space-y-1 text-sm">
                    {tr('validity')}
                    <select
                        className="h-10 w-full rounded-md border bg-background px-3"
                        value={draft.validity}
                        onChange={(event) =>
                            onChange({
                                ...draft,
                                validity: event.target.value as AddonVersionDraft['validity']
                            })
                        }
                    >
                        <option value="WHILE_SUBSCRIPTION_ALIVE">
                            {tr('validities.WHILE_SUBSCRIPTION_ALIVE')}
                        </option>
                        <option value="FIXED_DAYS">{tr('validities.FIXED_DAYS')}</option>
                    </select>
                </label>
            </div>
            {draft.validity === 'FIXED_DAYS' ? (
                <label className="block space-y-1 text-sm">
                    {tr('validityDays')}
                    <input
                        className="h-10 w-full rounded-md border bg-background px-3"
                        type="number"
                        min="1"
                        value={draft.validityDays}
                        onChange={(event) =>
                            onChange({ ...draft, validityDays: event.target.value })
                        }
                    />
                </label>
            ) : null}
            <div className="space-y-2">
                <p className="font-medium text-sm">{tr('entitlements')}</p>
                {draft.entitlements.map((key, index) => (
                    <div
                        key={entitlementIds.current[index]}
                        className="flex gap-2"
                    >
                        <input
                            data-testid={`addon-version-entitlement-${key || index}`}
                            aria-label={`${tr('entitlementKey')} ${index + 1}`}
                            className="h-10 flex-1 rounded-md border bg-background px-3"
                            value={key}
                            onChange={(event) =>
                                onChange({
                                    ...draft,
                                    entitlements: draft.entitlements.map((item, itemIndex) =>
                                        itemIndex === index ? event.target.value : item
                                    )
                                })
                            }
                        />
                        <button
                            type="button"
                            className="rounded-md border px-3"
                            aria-label={`${tr('remove')} ${key}`}
                            onClick={() => {
                                entitlementIds.current.splice(index, 1);
                                onChange({
                                    ...draft,
                                    entitlements: draft.entitlements.filter(
                                        (_, itemIndex) => itemIndex !== index
                                    )
                                });
                            }}
                        >
                            {tr('remove')}
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm"
                    onClick={() =>
                        onChange({ ...draft, entitlements: [...draft.entitlements, ''] })
                    }
                >
                    {tr('addEntitlement')}
                </button>
            </div>
            <div className="space-y-2">
                <p className="font-medium text-sm">{tr('limits')}</p>
                {draft.limits.map((limit, index) => (
                    <div
                        key={limitIds.current[index]}
                        className="flex gap-2"
                    >
                        <input
                            aria-label={`${tr('limitKey')} ${index + 1}`}
                            className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3"
                            value={limit.key}
                            onChange={(event) =>
                                onChange({
                                    ...draft,
                                    limits: draft.limits.map((item, itemIndex) =>
                                        itemIndex === index
                                            ? { ...item, key: event.target.value }
                                            : item
                                    )
                                })
                            }
                        />
                        <input
                            aria-label={`${tr('limitValue')} ${index + 1}`}
                            className="h-10 w-24 rounded-md border bg-background px-3"
                            type="number"
                            min="0"
                            value={limit.value}
                            onChange={(event) =>
                                onChange({
                                    ...draft,
                                    limits: draft.limits.map((item, itemIndex) =>
                                        itemIndex === index
                                            ? { ...item, value: event.target.value }
                                            : item
                                    )
                                })
                            }
                        />
                        <button
                            type="button"
                            className="rounded-md border px-3"
                            aria-label={`${tr('remove')} ${limit.key}`}
                            onClick={() => {
                                limitIds.current.splice(index, 1);
                                onChange({
                                    ...draft,
                                    limits: draft.limits.filter(
                                        (_, itemIndex) => itemIndex !== index
                                    )
                                });
                            }}
                        >
                            {tr('remove')}
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm"
                    onClick={() =>
                        onChange({ ...draft, limits: [...draft.limits, { key: '', value: '' }] })
                    }
                >
                    {tr('addLimit')}
                </button>
            </div>
        </fieldset>
    );
}
