/**
 * Sync Models Section (HOS-94 T-011/T-012)
 *
 * Renders the "Sync models" action and the resulting model list for a single
 * AI provider credential. Lives inside `EditCredentialDialog`
 * (`../credentials.tsx`) so that "confirming" a selection reuses that
 * dialog's existing `Save` button and its existing `metadata` read-merge
 * (baseURL/label preserved) — this component never persists anything itself.
 *
 * Before the operator clicks "Sync models", the curated `KNOWN_PROVIDERS`
 * list is shown (today's behavior, unchanged). After a successful sync, the
 * curated list is replaced by the single detected/curated/both merged list
 * from the API (HOS-94 §8 — approved layout), each row annotated with a
 * source badge; genuinely new (`source: 'detected'`) models are highlighted
 * and `capabilityHint === 'uncertain'` models get an extra muted chip. The
 * enabled-models toggle state and the custom-add mechanic are unchanged by
 * sync — they operate on the same `selectedModels` array regardless of
 * whether it was seeded from `curatedModels` or from a synced result.
 *
 * ## Auto-removal of denylisted ids on sync (owner follow-up)
 *
 * A fresh sync result may report `hiddenModelIds` — raw ids the API's
 * chat-capability denylist just excluded (audio/realtime/codex/search/
 * deep-research/image/embedding/tts/whisper/dall-e/moderation families). Any
 * of those ids that were previously enabled in `selectedModels` are removed
 * automatically as soon as the result arrives (see the `useEffect` below).
 * Hand-typed custom ids the provider API never returned at all are NEVER in
 * `hiddenModelIds` (the backend can only "hide" an id it actually saw), so
 * they are always preserved untouched by this removal.
 */

import { useTranslations } from '@repo/i18n';
import { AlertCircleIcon, DeleteIcon, LoaderIcon, RefreshIcon } from '@repo/icons';
import type { AiProviderModel, AiSyncModelsResult } from '@repo/schemas';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSyncModelsMutation } from '@/features/ai-settings';
import { isApiError } from '@/lib/errors';
import { cn } from '@/lib/utils';

/** Translation function type, as returned by `useTranslations()`. */
type TranslateFn = ReturnType<typeof useTranslations>['t'];

// ---------------------------------------------------------------------------
// Error classification (T-012)
// ---------------------------------------------------------------------------

/** Human-readable description of a sync-models failure, plus whether a retry could help. */
export interface SyncErrorDescription {
    readonly message: string;
    /** `true` only for errors where trying again might succeed (e.g. rate limit / outage). */
    readonly retryable: boolean;
}

/**
 * Maps a thrown sync-models error to a user-facing message + retry policy.
 *
 * - 400 `VALIDATION_ERROR` (provider rejected the stored key) — actionable,
 *   not retryable: the operator must fix/rotate the credential.
 * - 404 `NOT_FOUND` (no credential configured) — not retryable, same fix path.
 * - 503 `SERVICE_UNAVAILABLE` (rate-limited or provider down) — retryable.
 * - Anything else (network failure, unexpected shape) — generic message,
 *   retryable, since it may be transient.
 *
 * @param error - The value thrown/captured by the sync mutation.
 * @param t - Translation function from `useTranslations()`.
 */
export function describeSyncError(error: unknown, t: TranslateFn): SyncErrorDescription {
    if (isApiError(error)) {
        if (error.code === 'VALIDATION_ERROR' || error.status === 400) {
            return {
                message: t('admin-ai.credentials.syncModels.error.invalidKey'),
                retryable: false
            };
        }
        if (error.code === 'NOT_FOUND' || error.status === 404) {
            return {
                message: t('admin-ai.credentials.syncModels.error.notConfigured'),
                retryable: false
            };
        }
        if (error.code === 'SERVICE_UNAVAILABLE' || error.status === 503) {
            return {
                message: t('admin-ai.credentials.syncModels.error.providerUnavailable'),
                retryable: true
            };
        }
    }
    return { message: t('admin-ai.credentials.syncModels.error.generic'), retryable: true };
}

/** Sorts the merged catalog curated-first (curated/both), then newly-detected-only. */
function sortMergedModels(models: readonly AiProviderModel[]): AiProviderModel[] {
    return [...models].sort((a, b) => {
        const rank = (m: AiProviderModel) => (m.source === 'detected' ? 1 : 0);
        return rank(a) - rank(b);
    });
}

/**
 * Removes any id present in `hiddenModelIds` from `selectedModels`, leaving
 * every other id — including hand-typed custom ids the provider API never
 * returned — untouched. Order of the remaining ids is preserved.
 *
 * @param selectedModels - Currently enabled model ids.
 * @param hiddenModelIds - Ids the sync result's denylist just excluded (owner
 * follow-up); `undefined`/empty means nothing needs removing.
 * @returns A new array with the denylisted ids removed.
 */
function removeHiddenModelIds(
    selectedModels: readonly string[],
    hiddenModelIds: readonly string[] | undefined
): string[] {
    if (!hiddenModelIds || hiddenModelIds.length === 0) {
        return [...selectedModels];
    }
    const hiddenSet = new Set(hiddenModelIds);
    return selectedModels.filter((model) => !hiddenSet.has(model));
}

/** Badge variant per merge source. */
function badgeVariantForSource(
    source: AiProviderModel['source']
): 'default' | 'secondary' | 'success' {
    if (source === 'detected') return 'success';
    if (source === 'both') return 'default';
    return 'secondary';
}

/** Translation key for a merge source's badge label. */
function badgeLabelKey(
    source: AiProviderModel['source']
): 'badgeDetected' | 'badgeCurated' | 'badgeBoth' {
    if (source === 'detected') return 'badgeDetected';
    if (source === 'both') return 'badgeBoth';
    return 'badgeCurated';
}

// ---------------------------------------------------------------------------
// Row renderer (shared by pre-sync curated rows and post-sync merged rows)
// ---------------------------------------------------------------------------

interface ModelRowProps {
    readonly id: string;
    readonly enabled: boolean;
    readonly onToggle: () => void;
    readonly onRemove: () => void;
    readonly source?: AiProviderModel['source'];
    readonly uncertain?: boolean;
    readonly isCustom?: boolean;
}

function ModelRow({ id, enabled, onToggle, onRemove, source, uncertain, isCustom }: ModelRowProps) {
    const { t } = useTranslations();

    return (
        <div
            className={cn(
                'flex items-center justify-between rounded-md border p-2',
                isCustom ? 'border-dashed' : 'hover:bg-muted/50',
                source === 'detected' && 'border-primary/40 bg-primary/5'
            )}
        >
            <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{id}</span>
                {source && (
                    <Badge
                        variant={badgeVariantForSource(source)}
                        className="text-[10px]"
                    >
                        {t(`admin-ai.credentials.syncModels.${badgeLabelKey(source)}`)}
                    </Badge>
                )}
                {uncertain && (
                    <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                    >
                        {t('admin-ai.credentials.syncModels.uncertainChip')}
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Switch
                    checked={enabled}
                    onCheckedChange={onToggle}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={onRemove}
                >
                    <DeleteIcon className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

function SyncErrorBanner({
    error,
    onRetry
}: {
    readonly error: unknown;
    readonly onRetry: () => void;
}) {
    const { t } = useTranslations();
    const { message, retryable } = describeSyncError(error, t);

    return (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
                <p className="text-destructive text-xs">{message}</p>
                {retryable && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={onRetry}
                    >
                        {t('admin-ai.credentials.syncModels.error.retry')}
                    </Button>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export interface SyncModelsSectionProps {
    /** AI provider identifier — must have an active stored credential to sync. */
    readonly providerId: string;
    /** Curated `KNOWN_PROVIDERS[providerId].models` fallback, shown before the first sync. */
    readonly curatedModels: readonly string[];
    /** Currently enabled model ids (lifted state, owned by the parent dialog). */
    readonly selectedModels: string[];
    /** Called whenever the enabled set changes (toggle, add, or remove). */
    readonly onSelectedModelsChange: (models: string[]) => void;
}

/**
 * "Sync models" action + source-badged model list for one provider credential.
 *
 * @see HOS-94 spec §8 (UX) and §9 (AC-4) for the approved single-list layout.
 */
export function SyncModelsSection({
    providerId,
    curatedModels,
    selectedModels,
    onSelectedModelsChange
}: SyncModelsSectionProps) {
    const { t } = useTranslations();
    const syncMutation = useSyncModelsMutation();
    const [newModel, setNewModel] = useState('');

    // Refs mirroring the latest lifted props, read (not depended on) by the
    // auto-removal effect below so it reacts only to a NEW sync result.
    const selectedModelsRef = useRef(selectedModels);
    const onSelectedModelsChangeRef = useRef(onSelectedModelsChange);
    useEffect(() => {
        selectedModelsRef.current = selectedModels;
        onSelectedModelsChangeRef.current = onSelectedModelsChange;
    });

    const syncResult: AiSyncModelsResult | undefined = syncMutation.data;

    // Auto-removal of denylisted ids on sync (owner follow-up, HOS-94): a
    // previously-enabled id that the fresh sync now reports as
    // `hiddenModelIds` is dropped from the selection. Runs once per new
    // `syncResult` — NOT on every `selectedModels` change — otherwise it
    // would keep re-stripping an id the operator deliberately re-adds later.
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reacts only to syncResult identity (a new sync); selectedModels/onSelectedModelsChange are read via refs updated every render instead, so re-running on every selection change doesn't fight the operator's own toggles.
    useEffect(() => {
        if (!syncResult?.hiddenModelIds || syncResult.hiddenModelIds.length === 0) {
            return;
        }
        const next = removeHiddenModelIds(selectedModelsRef.current, syncResult.hiddenModelIds);
        if (next.length !== selectedModelsRef.current.length) {
            onSelectedModelsChangeRef.current(next);
        }
    }, [syncResult]);

    const toggleModel = (model: string) => {
        onSelectedModelsChange(
            selectedModels.includes(model)
                ? selectedModels.filter((m) => m !== model)
                : [...selectedModels, model]
        );
    };

    const removeModel = (model: string) => {
        onSelectedModelsChange(selectedModels.filter((m) => m !== model));
    };

    const addCustomModel = () => {
        const trimmed = newModel.trim();
        if (!trimmed || selectedModels.includes(trimmed)) return;
        onSelectedModelsChange([...selectedModels, trimmed]);
        setNewModel('');
    };

    const handleSync = () => {
        syncMutation.mutate(providerId);
    };

    const mergedModels = syncResult ? sortMergedModels(syncResult.models) : null;
    const knownIds = mergedModels ? mergedModels.map((m) => m.id) : curatedModels;

    const detectedCount = syncResult
        ? syncResult.models.filter((m) => m.source === 'detected' || m.source === 'both').length
        : 0;
    const newCount = syncResult
        ? syncResult.models.filter((m) => m.source === 'detected').length
        : 0;

    return (
        <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                    <Label>{t('admin-ai.credentials.syncModels.label')}</Label>
                    <p className="mt-1 text-muted-foreground text-xs">
                        {t('admin-ai.credentials.syncModels.hint')}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={syncMutation.isPending}
                >
                    {syncMutation.isPending ? (
                        <LoaderIcon className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <RefreshIcon className="mr-2 h-3.5 w-3.5" />
                    )}
                    {t('admin-ai.credentials.syncModels.button')}
                </Button>
            </div>

            {/* Loading state (T-012) */}
            {syncMutation.isPending && (
                <p className="mb-3 text-muted-foreground text-xs">
                    {t('admin-ai.credentials.syncModels.loading')}
                </p>
            )}

            {/* Error state (T-012) — page/other providers stay functional (AC-4) */}
            {syncMutation.isError && (
                <SyncErrorBanner
                    error={syncMutation.error}
                    onRetry={handleSync}
                />
            )}

            {/* Count summary + empty state (T-012) */}
            {syncResult && mergedModels && mergedModels.length > 0 && (
                <p className="mb-2 text-muted-foreground text-xs">
                    {t('admin-ai.credentials.syncModels.summary', {
                        detected: detectedCount,
                        new: newCount
                    })}
                </p>
            )}
            {syncResult && mergedModels && mergedModels.length === 0 && (
                <p className="mb-3 text-muted-foreground text-xs">
                    {t('admin-ai.credentials.syncModels.empty')}
                </p>
            )}

            <div className="grid gap-2">
                {/*
                 * Sync-detected models default to DISABLED (owner adjustment,
                 * HOS-94 follow-up): `enabled` is derived ONLY from the
                 * pre-existing `selectedModels` set, which a sync call never
                 * mutates. A newly-detected id (not previously in
                 * `selectedModels`) therefore always renders OFF; an id the
                 * operator already had enabled stays ON as long as it's still
                 * present in the merged result. Never auto-add a synced id to
                 * `selectedModels` here — that would silently opt the
                 * credential into models the operator never reviewed.
                 */}
                {mergedModels
                    ? mergedModels.map((model) => (
                          <ModelRow
                              key={model.id}
                              id={model.id}
                              enabled={selectedModels.includes(model.id)}
                              onToggle={() => toggleModel(model.id)}
                              onRemove={() => removeModel(model.id)}
                              source={model.source}
                              uncertain={model.capabilityHint === 'uncertain'}
                          />
                      ))
                    : curatedModels.map((model) => (
                          <ModelRow
                              key={model}
                              id={model}
                              enabled={selectedModels.includes(model)}
                              onToggle={() => toggleModel(model)}
                              onRemove={() => removeModel(model)}
                          />
                      ))}

                {/* Custom models — not in the curated list nor the synced result */}
                {selectedModels
                    .filter((m) => !knownIds.includes(m))
                    .map((model) => (
                        <ModelRow
                            key={model}
                            id={model}
                            enabled={true}
                            onToggle={() => toggleModel(model)}
                            onRemove={() => removeModel(model)}
                            isCustom
                        />
                    ))}
            </div>

            {/* Add custom model */}
            <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                    <Input
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        placeholder={t('admin-ai.credentials.syncModels.addCustomPlaceholder')}
                        className="h-8 text-xs"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addCustomModel();
                            }
                        }}
                    />
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomModel}
                    disabled={!newModel.trim()}
                >
                    {t('admin-ai.credentials.syncModels.addButton')}
                </Button>
            </div>
        </div>
    );
}
