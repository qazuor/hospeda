import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AiModelParams } from '@/features/ai-settings';
import { ChevronDownIcon } from '@repo/icons';

/**
 * Collapsible panel for overriding AI model parameters (temperature, maxTokens, topP).
 *
 * Shows the current persisted values as read-only reference and allows the user
 * to set override values for testing in the playground.
 */
export function AdvancedSettingsPanel(props: {
    readonly params: AiModelParams;
    readonly onChange: (params: AiModelParams) => void;
    readonly currentParams: AiModelParams | undefined;
    readonly isOpen: boolean;
    readonly onToggle: () => void;
}) {
    const { params, onChange, currentParams, isOpen, onToggle } = props;

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
                <span className="font-medium">Configuración avanzada</span>
                <ChevronDownIcon
                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="space-y-4 rounded-md border p-4">
                    {/* Current values display */}
                    {currentParams && (
                        <div className="mb-3 rounded-md bg-muted/50 p-2 text-xs">
                            <span className="text-muted-foreground">Valores actuales: </span>
                            <span className="font-mono">
                                temp={currentParams.temperature ?? '—'}, tokens=
                                {currentParams.maxTokens ?? '—'}, topP={currentParams.topP ?? '—'}
                            </span>
                        </div>
                    )}

                    {/* Temperature */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="temperature">Temperature</Label>
                            <span className="font-mono text-muted-foreground text-xs">
                                {params.temperature}
                            </span>
                        </div>
                        <input
                            id="temperature"
                            type="range"
                            min={0}
                            max={2}
                            step={0.1}
                            value={params.temperature ?? 0.7}
                            onChange={(e) =>
                                onChange({ ...params, temperature: Number(e.target.value) })
                            }
                            className="w-full"
                        />
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-1">
                        <Label htmlFor="max-tokens">Max Tokens (opcional)</Label>
                        <Input
                            id="max-tokens"
                            type="number"
                            min={1}
                            value={params.maxTokens ?? ''}
                            onChange={(e) =>
                                onChange({
                                    ...params,
                                    maxTokens: e.target.value ? Number(e.target.value) : undefined
                                })
                            }
                            placeholder="Sin límite"
                        />
                    </div>

                    {/* Top P */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="top-p">Top P (opcional)</Label>
                            <span className="font-mono text-muted-foreground text-xs">
                                {params.topP ?? '—'}
                            </span>
                        </div>
                        <input
                            id="top-p"
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={params.topP ?? 1}
                            onChange={(e) => onChange({ ...params, topP: Number(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
