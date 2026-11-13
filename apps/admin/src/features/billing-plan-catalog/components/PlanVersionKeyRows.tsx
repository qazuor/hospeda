import type { TranslationKey } from '@repo/i18n';
import { ENTITLEMENT_KEY_DEFINITIONS, LIMIT_KEY_DEFINITIONS } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import type { PlanVersionDraft } from '../lib/plan-version-draft';

/** Renders editable entitlement and limit rows for a plan version. */
export function PlanVersionKeyRows({
    draft,
    setDraft,
    trialRole
}: {
    readonly draft: PlanVersionDraft;
    readonly setDraft: (draft: PlanVersionDraft) => void;
    readonly trialRole: boolean;
}) {
    const { t } = useTranslations();
    const tr = (key: string) => t(key as TranslationKey);
    const entitlements = [...ENTITLEMENT_KEY_DEFINITIONS].sort((a, b) =>
        a.key.localeCompare(b.key)
    );
    const limits = [...LIMIT_KEY_DEFINITIONS].sort((a, b) => a.key.localeCompare(b.key));
    const formKey = 'admin-billing.planCatalogEditor.form.';
    return (
        <div className="space-y-5">
            <fieldset className="space-y-3 rounded-md border p-4">
                <legend className="px-1">{tr(`${formKey}entitlementsLegend`)}</legend>
                {draft.entitlements.map((row, index) => (
                    <div
                        key={row.rowId}
                        className="grid gap-2 md:grid-cols-4"
                    >
                        <select
                            aria-label={tr(`${formKey}key`)}
                            value={row.key}
                            onChange={(event) => {
                                const next = [...draft.entitlements];
                                next[index] = { ...row, key: event.target.value };
                                setDraft({ ...draft, entitlements: next });
                            }}
                        >
                            <option value="" />
                            {entitlements.map(({ key }) => (
                                <option
                                    key={key}
                                    value={key}
                                >
                                    {key}
                                </option>
                            ))}
                        </select>
                        <Input
                            aria-label={tr(`${formKey}planQuota`)}
                            inputMode="numeric"
                            value={row.planQuota}
                            onChange={(event) => {
                                const next = [...draft.entitlements];
                                next[index] = { ...row, planQuota: event.target.value };
                                setDraft({ ...draft, entitlements: next });
                            }}
                        />
                        <Input
                            aria-label={tr(`${formKey}trialQuota`)}
                            inputMode="numeric"
                            value={row.trialQuota}
                            onChange={(event) => {
                                const next = [...draft.entitlements];
                                next[index] = { ...row, trialQuota: event.target.value };
                                setDraft({ ...draft, entitlements: next });
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setDraft({
                                    ...draft,
                                    entitlements: draft.entitlements.filter(
                                        (_, rowIndex) => rowIndex !== index
                                    )
                                })
                            }
                        >
                            {tr(`${formKey}remove`)}
                        </Button>
                    </div>
                ))}
                <p className="text-muted-foreground text-sm">{tr(`${formKey}quotasHelp`)}</p>
                {trialRole ? <p>{tr(`${formKey}trialNote`)}</p> : null}
                <Button
                    type="button"
                    variant="outline"
                    disabled={trialRole}
                    onClick={() =>
                        setDraft({
                            ...draft,
                            entitlements: [
                                ...draft.entitlements,
                                {
                                    rowId: crypto.randomUUID(),
                                    key: '',
                                    planQuota: '',
                                    trialQuota: ''
                                }
                            ]
                        })
                    }
                >
                    {tr(`${formKey}addEntitlement`)}
                </Button>
            </fieldset>
            <fieldset className="space-y-3 rounded-md border p-4">
                <legend className="px-1">{tr(`${formKey}limitsLegend`)}</legend>
                {draft.limits.map((row, index) => (
                    <div
                        key={row.rowId}
                        className="grid gap-2 md:grid-cols-3"
                    >
                        <select
                            aria-label={tr(`${formKey}key`)}
                            value={row.key}
                            onChange={(event) => {
                                const next = [...draft.limits];
                                next[index] = { ...row, key: event.target.value };
                                setDraft({ ...draft, limits: next });
                            }}
                        >
                            <option value="" />
                            {limits.map(({ key }) => (
                                <option
                                    key={key}
                                    value={key}
                                >
                                    {key}
                                </option>
                            ))}
                        </select>
                        <Input
                            aria-label={tr(`${formKey}value`)}
                            inputMode="numeric"
                            value={row.value}
                            onChange={(event) => {
                                const next = [...draft.limits];
                                next[index] = { ...row, value: event.target.value };
                                setDraft({ ...draft, limits: next });
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setDraft({
                                    ...draft,
                                    limits: draft.limits.filter((_, rowIndex) => rowIndex !== index)
                                })
                            }
                        >
                            {tr(`${formKey}remove`)}
                        </Button>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                        setDraft({
                            ...draft,
                            limits: [
                                ...draft.limits,
                                { rowId: crypto.randomUUID(), key: '', value: '' }
                            ]
                        })
                    }
                >
                    {tr(`${formKey}addLimit`)}
                </Button>
            </fieldset>
        </div>
    );
}
