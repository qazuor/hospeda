import { useRouter } from 'expo-router';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { theme } from '../../../src/design';
import { useOwnAccommodations } from '../../../src/lib/api/hooks/use-own-accommodations';
import type { OwnAccommodationsList } from '../../../src/lib/api/hooks/use-own-accommodations';
import { appDefaultLocale, getTranslation } from '../../../src/lib/i18n';
import { logger } from '../../../src/lib/logger';

/** One item in the accommodations list (subset of AccommodationProtected). */
type AccommodationListItem = OwnAccommodationsList['items'][number];

/**
 * Host accommodations list screen (SPEC-243 T-041).
 *
 * Fetches GET /api/v1/protected/accommodations (page 1, pageSize 12).
 * Renders a FlatList of accommodation cards with name, destination city,
 * and lifecycle state badge.
 *
 * Tapping a card navigates to ./[id] (detail + edit screen).
 *
 * Loading, error, and empty states are handled explicitly.
 *
 * Expo Router requires a **default export** for route files.
 * Styling uses StyleSheet.create at module scope (ADR-034).
 */
export default function AccommodationsListScreen() {
    const t = (key: string) => getTranslation(key, appDefaultLocale);
    const router = useRouter();
    const { data, isLoading, error, refetch } = useOwnAccommodations({ page: 1, pageSize: 12 });

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.river[500]}
                />
                <Text style={styles.loadingText}>{t('mobile.host.accommodations.loading')}</Text>
            </View>
        );
    }

    if (error) {
        logger.warn('AccommodationsList fetch error', { error: String(error) });
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{t('mobile.host.accommodations.error')}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => void refetch()}
                >
                    <Text style={styles.retryButtonText}>
                        {t('mobile.host.accommodations.retry')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    const items = data?.items ?? [];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('mobile.host.accommodations.listTitle')}</Text>
            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: ListRenderItemInfo<AccommodationListItem>) => (
                    <AccommodationCard
                        item={item}
                        onPress={() => router.push(`/(host)/accommodations/${item.id}`)}
                        t={t}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {t('mobile.host.accommodations.empty')}
                        </Text>
                    </View>
                }
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

interface AccommodationCardProps {
    item: AccommodationListItem;
    onPress: () => void;
    t: (key: string) => string;
}

/**
 * Renders a single accommodation summary card.
 * Shows: name, destination city (from cityDestination or destinationId), lifecycle badge.
 */
function AccommodationCard({ item, onPress, t }: AccommodationCardProps) {
    const cityName = item.cityDestination?.name ?? null;
    const lifecycleLabel = getLifecycleLabel(item.lifecycleState, t);
    const lifecycleBadgeStyle = getLifecycleBadgeStyle(item.lifecycleState);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={item.name}
        >
            <View style={styles.cardContent}>
                <View style={styles.cardLeft}>
                    <Text
                        style={styles.cardName}
                        numberOfLines={2}
                    >
                        {item.name}
                    </Text>
                    {cityName ? (
                        <Text
                            style={styles.cardCity}
                            numberOfLines={1}
                        >
                            {cityName}
                        </Text>
                    ) : null}
                </View>
                <View style={[styles.lifecycleBadge, lifecycleBadgeStyle]}>
                    <Text style={styles.lifecycleBadgeText}>{lifecycleLabel}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the i18n label for a lifecycle state.
 */
function getLifecycleLabel(state: string, t: (key: string) => string): string {
    const map: Record<string, string> = {
        ACTIVE: t('mobile.host.accommodations.lifecycleActive'),
        DRAFT: t('mobile.host.accommodations.lifecycleDraft'),
        ARCHIVED: t('mobile.host.accommodations.lifecycleArchived')
    };
    return map[state] ?? state;
}

/**
 * Returns style overrides for the lifecycle badge background.
 */
function getLifecycleBadgeStyle(state: string): object {
    switch (state) {
        case 'ACTIVE':
            return badgeActiveStyle;
        case 'DRAFT':
            return badgeDraftStyle;
        case 'ARCHIVED':
            return badgeArchivedStyle;
        default:
            return {};
    }
}

const badgeActiveStyle = { backgroundColor: theme.colors.success[100] };
const badgeDraftStyle = { backgroundColor: theme.colors.river[100] };
const badgeArchivedStyle = { backgroundColor: theme.colors.neutral[200] };

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
    list: {
        paddingBottom: theme.spacing[10]
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
    emptyContainer: {
        alignItems: 'center',
        marginTop: theme.spacing[12]
    },
    emptyText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[400]
    },
    card: {
        backgroundColor: theme.colors.neutral[50],
        borderRadius: theme.radius.semantic.card,
        borderWidth: 1,
        borderColor: theme.colors.semantic.border,
        marginBottom: theme.spacing[3],
        padding: theme.spacing[4]
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.spacing[3]
    },
    cardLeft: {
        flex: 1
    },
    cardName: {
        fontSize: theme.typography.semantic.body,
        fontWeight: '600',
        color: theme.colors.neutral[700],
        marginBottom: theme.spacing[1]
    },
    cardCity: {
        fontSize: theme.typography.semantic.bodySm,
        color: theme.colors.neutral[500]
    },
    lifecycleBadge: {
        borderRadius: theme.radius.semantic.pill,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[1],
        alignSelf: 'flex-start'
    },
    lifecycleBadgeText: {
        fontSize: theme.typography.semantic.caption,
        fontWeight: '600',
        color: theme.colors.neutral[700]
    }
});
