/**
 * shadcn/ui Chart primitives — canonical chart.tsx (SPEC-155).
 *
 * Provides ChartContainer, ChartTooltip, ChartTooltipContent,
 * ChartLegend, ChartLegendContent, and the ChartConfig type that
 * the rest of the admin chart components consume.
 *
 * Built on top of Recharts (required peer dependency).
 *
 * @see https://ui.shadcn.com/docs/components/chart
 */

import { cn } from '@/lib/utils';
import * as React from 'react';
import * as RechartsPrimitive from 'recharts';

// ============================================================================
// CHART CONFIG TYPE
// ============================================================================

/**
 * Per-series configuration passed to ChartContainer.
 * Each key maps to a series / data key used in the chart.
 */
export type ChartConfig = {
    readonly [k in string]: {
        readonly label?: React.ReactNode;
        readonly icon?: React.ComponentType<{ readonly className?: string }>;
    } & (
        | { readonly color?: string; readonly theme?: never }
        | { readonly color?: never; readonly theme: Record<string, string> }
    );
};

// ============================================================================
// CHART CONTEXT
// ============================================================================

interface ChartContextProps {
    readonly config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

/**
 * Returns the ChartContext. Must be called inside a ChartContainer.
 */
export function useChart(): ChartContextProps {
    const context = React.useContext(ChartContext);

    if (!context) {
        throw new Error('useChart must be used within a <ChartContainer />');
    }

    return context;
}

// ============================================================================
// CHART CONTAINER
// ============================================================================

/**
 * Wraps a Recharts root component in a themed, accessible container.
 * Injects CSS custom properties for each series color defined in `config`.
 *
 * @example
 * ```tsx
 * <ChartContainer config={chartConfig} className="h-[200px]">
 *   <BarChart data={data}>…</BarChart>
 * </ChartContainer>
 * ```
 */
export const ChartContainer = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> & {
        readonly config: ChartConfig;
        readonly children: React.ComponentProps<
            typeof RechartsPrimitive.ResponsiveContainer
        >['children'];
    }
>(({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-chart={chartId}
                ref={ref}
                className={cn(
                    'flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke="#fff"]]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border [&_.recharts-sector[stroke="#fff"]]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none',
                    className
                )}
                {...props}
            >
                <ChartStyle
                    id={chartId}
                    config={config}
                />
                <RechartsPrimitive.ResponsiveContainer>
                    {children}
                </RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
});
ChartContainer.displayName = 'ChartContainer';

// ============================================================================
// CHART STYLE (injects CSS vars for series colors)
// ============================================================================

function ChartStyle({
    id,
    config
}: {
    readonly id: string;
    readonly config: ChartConfig;
}) {
    const colorConfig = Object.entries(config).filter(([, entry]) => entry.theme ?? entry.color);

    if (!colorConfig.length) {
        return null;
    }

    return (
        <style
            // biome-ignore lint/security/noDangerouslySetInnerHtml: safe — only CSS var declarations generated from validated config
            dangerouslySetInnerHTML={{
                __html: Object.entries({ '': 'light', '[data-theme="dark"]': 'dark' })
                    .map(([selector, theme]) => {
                        return `
${selector} [data-chart=${id}] {
${colorConfig
    .map(([key, itemConfig]) => {
        const color = itemConfig.theme?.[theme] ?? itemConfig.color;
        return color ? `  --color-${key}: ${color};` : null;
    })
    .filter(Boolean)
    .join('\n')}
}`;
                    })
                    .join('\n')
            }}
        />
    );
}

// ============================================================================
// CHART TOOLTIP (re-export + thin wrapper)
// ============================================================================

/** Re-export of Recharts Tooltip for use inside ChartContainer. */
export const ChartTooltip = RechartsPrimitive.Tooltip;

/**
 * Styled tooltip content for shadcn charts.
 * Pass as `content={<ChartTooltipContent />}` to ChartTooltip.
 */
export const ChartTooltipContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
        React.ComponentProps<'div'> & {
            readonly hideLabel?: boolean;
            readonly hideIndicator?: boolean;
            readonly indicator?: 'line' | 'dot' | 'dashed';
            readonly nameKey?: string;
            readonly labelKey?: string;
        }
>(
    (
        {
            active,
            payload,
            className,
            indicator = 'dot',
            hideLabel = false,
            hideIndicator = false,
            label,
            labelFormatter,
            labelClassName,
            formatter,
            color,
            nameKey,
            labelKey
        },
        ref
    ) => {
        const { config } = useChart();

        const tooltipLabel = React.useMemo(() => {
            if (hideLabel || !payload?.length) {
                return null;
            }

            const [item] = payload;
            const key = `${labelKey ?? item?.dataKey ?? item?.name ?? 'value'}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const value =
                !labelKey && typeof label === 'string'
                    ? (config[label]?.label ?? label)
                    : itemConfig?.label;

            if (labelFormatter) {
                return (
                    <div className={cn('font-medium', labelClassName)}>
                        {labelFormatter(value, payload)}
                    </div>
                );
            }

            if (!value) {
                return null;
            }

            return <div className={cn('font-medium', labelClassName)}>{value}</div>;
        }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

        if (!active || !payload?.length) {
            return null;
        }

        const nestLabel = payload.length === 1 && indicator !== 'dot';

        return (
            <div
                ref={ref}
                className={cn(
                    'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
                    className
                )}
            >
                {nestLabel ? null : tooltipLabel}
                <div className="grid gap-1.5">
                    {payload.map((item, index) => {
                        const key = `${nameKey ?? item.name ?? item.dataKey ?? 'value'}`;
                        const itemConfig = getPayloadConfigFromPayload(config, item, key);
                        const indicatorColor = color ?? item.payload?.fill ?? item.color;

                        return (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: stable tooltip rows indexed by payload position
                                key={index}
                                className={cn(
                                    'flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground',
                                    indicator === 'dot' && 'items-center'
                                )}
                            >
                                {formatter && item?.value !== undefined && item.name ? (
                                    formatter(item.value, item.name, item, index, item.payload)
                                ) : (
                                    <>
                                        {itemConfig?.icon ? (
                                            <itemConfig.icon />
                                        ) : (
                                            !hideIndicator && (
                                                <div
                                                    className={cn(
                                                        'shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]',
                                                        {
                                                            'h-2.5 w-2.5': indicator === 'dot',
                                                            'w-1': indicator === 'line',
                                                            'w-0 border-[1.5px] border-dashed bg-transparent':
                                                                indicator === 'dashed',
                                                            'my-0.5':
                                                                nestLabel && indicator === 'dashed'
                                                        }
                                                    )}
                                                    style={
                                                        {
                                                            '--color-bg': indicatorColor,
                                                            '--color-border': indicatorColor
                                                        } as React.CSSProperties
                                                    }
                                                />
                                            )
                                        )}
                                        <div
                                            className={cn(
                                                'flex flex-1 justify-between leading-none',
                                                nestLabel ? 'items-end' : 'items-center'
                                            )}
                                        >
                                            <div className="grid gap-1.5">
                                                {nestLabel ? tooltipLabel : null}
                                                <span className="text-muted-foreground">
                                                    {itemConfig?.label ?? item.name}
                                                </span>
                                            </div>
                                            {item.value !== undefined && (
                                                <span className="font-medium font-mono text-foreground tabular-nums">
                                                    {item.value.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

// ============================================================================
// CHART LEGEND
// ============================================================================

/** Re-export of Recharts Legend for use inside ChartContainer. */
export const ChartLegend = RechartsPrimitive.Legend;

/**
 * Styled legend content for shadcn charts.
 * Pass as `content={<ChartLegendContent />}` to ChartLegend.
 */
export const ChartLegendContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> &
        Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'> & {
            readonly hideIcon?: boolean;
            readonly nameKey?: string;
        }
>(({ className, hideIcon = false, payload, verticalAlign = 'bottom', nameKey }, ref) => {
    const { config } = useChart();

    if (!payload?.length) {
        return null;
    }

    return (
        <div
            ref={ref}
            className={cn(
                'flex items-center justify-center gap-4',
                verticalAlign === 'top' ? 'pb-3' : 'pt-3',
                className
            )}
        >
            {payload.map((item) => {
                const key = `${nameKey ?? item.dataKey ?? 'value'}`;
                const itemConfig = getPayloadConfigFromPayload(config, item, key);

                return (
                    <div
                        key={item.value as string}
                        className={cn(
                            'flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground'
                        )}
                    >
                        {itemConfig?.icon && !hideIcon ? (
                            <itemConfig.icon />
                        ) : (
                            <div
                                className="h-2 w-2 shrink-0 rounded-[2px]"
                                style={{
                                    backgroundColor: item.color
                                }}
                            />
                        )}
                        {itemConfig?.label}
                    </div>
                );
            })}
        </div>
    );
});
ChartLegendContent.displayName = 'ChartLegendContent';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extracts the ChartConfig entry for a given Recharts payload item.
 * Looks up by `nameKey` → `name` → `dataKey` in the config map.
 */
function getPayloadConfigFromPayload(
    config: ChartConfig,
    payload: unknown,
    key: string
): ChartConfig[string] | undefined {
    if (typeof payload !== 'object' || payload === null) {
        return undefined;
    }

    const typedPayload = payload as Record<string, unknown>;

    const payloadPayload =
        'payload' in typedPayload &&
        typeof typedPayload.payload === 'object' &&
        typedPayload.payload !== null
            ? (typedPayload.payload as Record<string, unknown>)
            : undefined;

    let configLabelKey: string = key;

    if (key in config) {
        configLabelKey = key;
    } else if (
        payloadPayload &&
        key in payloadPayload &&
        typeof payloadPayload[key] === 'string' &&
        payloadPayload[key] in config
    ) {
        configLabelKey = payloadPayload[key] as string;
    }

    return configLabelKey in config ? config[configLabelKey] : config[key];
}
