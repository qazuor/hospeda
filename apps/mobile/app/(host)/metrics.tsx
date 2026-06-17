import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { theme } from '../../src/design';
import { useAccommodationViewStats } from '../../src/lib/api/hooks/use-accommodation-view-stats';
import type {
    AccommodationViewStat,
    ViewWindow
} from '../../src/lib/api/hooks/use-accommodation-view-stats';
import { useOwnAccommodations } from '../../src/lib/api/hooks/use-own-accommodations';
import { appDefaultLocale, getTranslation } from '../../src/lib/i18n';
import { logger } from '../../src/lib/logger';

/**
 * Host metrics screen — per-accommodation view statistics (SPEC-243 T-045).
 *
 * Fetches GET /api/v1/protected/views/accommodations/me?window=7d|30d and
 * renders a per-accommodation list with unique and total view counts.
 *
 * Features:
 * - 7d / 30d window toggle that refetches automatically via TanStack Query.
 * - Loading, error, and empty states handled explicitly.
 * - No charting library (basic "per spec" variant — numbers/rows only).
 *
 * Daily series endpoint (`/me/daily-series`) is deferred — no chart lib
 * is permitted per scope constraints.
 *
 * Expo Router requires a **default export** for route files.
 * Styling uses StyleSheet.create at module scope (ADR-034).
 */
export default function HostMetricsScreen() {
    const t = (key: string) => getTranslation(key, appDefaultLocale);
    const [selectedWindow, setSelectedWindow] = useState<ViewWindow>('30d');
    const { data, isLoading, error, refetch } = useAccommodationViewStats({
        window: selectedWindow
    });

    // Fetch the host's own accommodations (large page) to build an id→name map.
    // pageSize 100 covers virtually all hosts; falls back to UUID slice when not found.
    const { data: ownAccommodationsData } = useOwnAccommodations({ pageSize: 100 });

    const accommodationNameMap = useMemo<Map<string, string>>(() => {
        const map = new Map<string, string>();
        for (const item of ownAccommodationsData?.items ?? []) {
            map.set(item.id, item.name);
        }
        return map;
    }, [ownAccommodationsData]);

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.river[500]}
                />
                <Text style={styles.loadingText}>{t('mobile.host.metrics.loading')}</Text>
            </View>
        );
    }

    if (error) {
        logger.warn('HostMetrics fetch error', { error: String(error) });
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{t('mobile.host.metrics.error')}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => void refetch()}
                >
                    <Text style={styles.retryButtonText}>{t('mobile.host.metrics.retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const items = data ?? [];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('mobile.host.metrics.title')}</Text>

            {/* Window toggle */}
            <WindowToggle
                current={selectedWindow}
                onSelect={setSelectedWindow}
                t={t}
            />

            {/* Column headers */}
            <View style={styles.headerRow}>
                <Text style={[styles.headerCell, styles.headerCellName]}>
                    {t('mobile.host.metrics.accommodationLabel')}
                </Text>
                <Text style={[styles.headerCell, styles.headerCellStat]}>
                    {t('mobile.host.metrics.uniqueLabel')}
                </Text>
                <Text style={[styles.headerCell, styles.headerCellStat]}>
                    {t('mobile.host.metrics.totalLabel')}
                </Text>
            </View>

            <FlatList
                data={items}
                keyExtractor={(item) => item.entityId}
                renderItem={({ item }: ListRenderItemInfo<AccommodationViewStat>) => (
                    <ViewStatRow
                        stat={item}
                        nameMap={accommodationNameMap}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{t('mobile.host.metrics.empty')}</Text>
                    </View>
                }
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// WindowToggle sub-component
// ---------------------------------------------------------------------------

interface WindowToggleProps {
    current: ViewWindow;
    onSelect: (w: ViewWindow) => void;
    t: (key: string) => string;
}

/**
 * 7d / 30d toggle button row for the metrics screen.
 */
function WindowToggle({ current, onSelect, t }: WindowToggleProps) {
    return (
        <View style={styles.toggleRow}>
            <ToggleButton
                label={t('mobile.host.metrics.window7d')}
                active={current === '7d'}
                onPress={() => onSelect('7d')}
            />
            <ToggleButton
                label={t('mobile.host.metrics.window30d')}
                active={current === '30d'}
                onPress={() => onSelect('30d')}
            />
        </View>
    );
}

interface ToggleButtonProps {
    label: string;
    active: boolean;
    onPress: () => void;
}

/**
 * Single pill button used inside WindowToggle.
 */
function ToggleButton({ label, active, onPress }: ToggleButtonProps) {
    return (
        <TouchableOpacity
            style={[styles.toggleButton, active ? styles.toggleButtonActive : null]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
        >
            <Text style={[styles.toggleButtonText, active ? styles.toggleButtonTextActive : null]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

// ---------------------------------------------------------------------------
// ViewStatRow sub-component
// ---------------------------------------------------------------------------

interface ViewStatRowProps {
    stat: AccommodationViewStat;
    /** Map of accommodation id → name, built from useOwnAccommodations. */
    nameMap: Map<string, string>;
}

/**
 * Renders one row in the metrics list: accommodation name + unique + total.
 *
 * Uses the `nameMap` (built from `useOwnAccommodations`) to show the property
 * name instead of a raw UUID. Falls back to the first 8 chars of the UUID
 * (uppercased) when the id is not yet in the map (e.g. accommodation count
 * exceeds the page-100 fetch, or the hook is still loading).
 */
function ViewStatRow({ stat, nameMap }: ViewStatRowProps) {
    const label = nameMap.get(stat.entityId) ?? stat.entityId.slice(0, 8).toUpperCase();

    return (
        <View style={styles.row}>
            <Text
                style={[styles.cell, styles.cellName]}
                numberOfLines={1}
            >
                {label}
            </Text>
            <Text style={[styles.cell, styles.cellStat]}>{stat.unique}</Text>
            <Text style={[styles.cell, styles.cellStat]}>{stat.total}</Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-034)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background,
        padding: theme.spacing[5]
    },
    centered: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[6]
    },
    title: {
        fontSize: theme.typography.semantic.h2,
        fontWeight: '700',
        color: theme.colors.neutral[700],
        marginBottom: theme.spacing[4]
    },
    loadingText: {
        marginTop: theme.spacing[3],
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[500]
    },
    errorText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.danger[600],
        textAlign: 'center',
        marginBottom: theme.spacing[4]
    },
    retryButton: {
        backgroundColor: theme.colors.river[500],
        borderRadius: theme.radius.semantic.button,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[6]
    },
    retryButtonText: {
        color: theme.colors.semantic.textInverted,
        fontSize: theme.typography.semantic.button,
        fontWeight: '600'
    },
    // Window toggle
    toggleRow: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        marginBottom: theme.spacing[4]
    },
    toggleButton: {
        borderRadius: theme.radius.semantic.pill,
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[4],
        borderWidth: 1,
        borderColor: theme.colors.river[300],
        backgroundColor: theme.colors.neutral[50]
    },
    toggleButtonActive: {
        backgroundColor: theme.colors.river[500],
        borderColor: theme.colors.river[500]
    },
    toggleButtonText: {
        fontSize: theme.typography.semantic.bodySm,
        fontWeight: '600',
        color: theme.colors.river[600]
    },
    toggleButtonTextActive: {
        color: theme.colors.semantic.textInverted
    },
    // Table header
    headerRow: {
        flexDirection: 'row',
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[1],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.semantic.border,
        marginBottom: theme.spacing[2]
    },
    headerCell: {
        fontSize: theme.typography.semantic.caption,
        fontWeight: '600',
        color: theme.colors.neutral[500],
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    headerCellName: {
        flex: 1
    },
    headerCellStat: {
        width: 72,
        textAlign: 'right'
    },
    // Data rows
    list: {
        paddingBottom: theme.spacing[10]
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[1],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.semantic.border
    },
    cell: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[700]
    },
    cellName: {
        flex: 1,
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[700]
    },
    cellStat: {
        width: 72,
        textAlign: 'right',
        fontWeight: '600'
    },
    // Empty state
    emptyContainer: {
        alignItems: 'center',
        marginTop: theme.spacing[12]
    },
    emptyText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[400],
        textAlign: 'center'
    }
});
