import { useRouter } from 'expo-router';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ChartBarIcon } from '../../src/components/icons';
import { theme } from '../../src/design';
import { useHostDashboard } from '../../src/lib/api/hooks/use-host-dashboard';
import type { HostDashboard } from '../../src/lib/api/hooks/use-host-dashboard';
import { getTranslation } from '../../src/lib/i18n';
import { useLocale } from '../../src/lib/locale-context';
import { logger } from '../../src/lib/logger';

/**
 * Host dashboard screen — read-only summary (SPEC-243 T-040).
 *
 * Fetches GET /api/v1/protected/host/dashboard and renders:
 * - Properties counts card (total, published, draft, archived)
 * - Unread conversations count card
 * - Plan summary card (name + status badge; null plan handled gracefully)
 *
 * Loading, error, and empty states are handled explicitly.
 *
 * Expo Router requires a **default export** for route files.
 * Styling uses StyleSheet.create at module scope (ADR-034).
 */
export default function HostDashboardScreen() {
    const { locale } = useLocale();
    const t = (key: string) => getTranslation(key, locale);
    const router = useRouter();
    const { data, isLoading, error, refetch } = useHostDashboard();

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.river[500]}
                />
                <Text style={styles.loadingText}>{t('mobile.host.dashboard.loading')}</Text>
            </View>
        );
    }

    if (error) {
        logger.warn('HostDashboard fetch error', { error: String(error) });
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{t('mobile.host.dashboard.error')}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => void refetch()}
                >
                    <Text style={styles.retryButtonText}>{t('mobile.host.dashboard.retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <Text style={styles.title}>{t('mobile.host.dashboard.title')}</Text>

            {/* Properties card */}
            {data ? (
                <PropertiesCard
                    data={data}
                    t={t}
                />
            ) : null}

            {/* Conversations card */}
            {data ? (
                <ConversationsCard
                    data={data}
                    t={t}
                />
            ) : null}

            {/* Plan card */}
            {data ? (
                <PlanCard
                    data={data}
                    t={t}
                />
            ) : null}

            {/* Metrics navigation row (PR-C addition — deferred from T-040) */}
            <TouchableOpacity
                style={styles.metricsRow}
                onPress={() => router.push('/(host)/metrics')}
                accessibilityRole="button"
            >
                <ChartBarIcon
                    color={theme.colors.river[500]}
                    size={20}
                    weight="regular"
                />
                <Text style={styles.metricsRowText}>{t('mobile.host.dashboard.viewMetrics')}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CardProps {
    data: HostDashboard;
    t: (key: string) => string;
}

/**
 * Renders the properties counts summary card.
 */
function PropertiesCard({ data, t }: CardProps) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('mobile.host.dashboard.propertiesCard')}</Text>
            <View style={styles.statsRow}>
                <StatCell
                    label={t('mobile.host.dashboard.total')}
                    value={data.properties.total}
                />
                <StatCell
                    label={t('mobile.host.dashboard.published')}
                    value={data.properties.published}
                    accent
                />
                <StatCell
                    label={t('mobile.host.dashboard.draft')}
                    value={data.properties.draft}
                />
                <StatCell
                    label={t('mobile.host.dashboard.archived')}
                    value={data.properties.archived}
                />
            </View>
        </View>
    );
}

/**
 * Renders the unread conversations count card.
 */
function ConversationsCard({ data, t }: CardProps) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('mobile.host.dashboard.conversationsCard')}</Text>
            <Text style={styles.bigNumber}>{data.unreadConversations}</Text>
        </View>
    );
}

/**
 * Renders the current plan summary card.
 * Handles plan=null gracefully with a "no plan" message.
 */
function PlanCard({ data, t }: CardProps) {
    const plan = data.plan;

    const planStatusLabel = (status: NonNullable<HostDashboard['plan']>['status']): string => {
        const map: Record<string, string> = {
            active: t('mobile.host.dashboard.planActive'),
            trial: t('mobile.host.dashboard.planTrial'),
            cancelled: t('mobile.host.dashboard.planCancelled'),
            expired: t('mobile.host.dashboard.planExpired'),
            past_due: t('mobile.host.dashboard.planPastDue')
        };
        return map[status] ?? status;
    };

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('mobile.host.dashboard.planCard')}</Text>
            {plan === null ? (
                <Text style={styles.mutedText}>{t('mobile.host.dashboard.planNull')}</Text>
            ) : (
                <View style={styles.planRow}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <View
                        style={[
                            styles.badge,
                            plan.status === 'active' || plan.isTrial
                                ? styles.badgeActive
                                : styles.badgeMuted
                        ]}
                    >
                        <Text
                            style={[
                                styles.badgeText,
                                plan.status === 'active' && !plan.isTrial
                                    ? styles.badgeTextActive
                                    : null
                            ]}
                        >
                            {plan.isTrial
                                ? t('mobile.host.dashboard.planTrial')
                                : planStatusLabel(plan.status)}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

// ---------------------------------------------------------------------------
// StatCell
// ---------------------------------------------------------------------------

interface StatCellProps {
    label: string;
    value: number;
    accent?: boolean;
}

/**
 * Single stat label + number in the properties card grid.
 */
function StatCell({ label, value, accent = false }: StatCellProps) {
    return (
        <View style={styles.statCell}>
            <Text style={[styles.statValue, accent ? styles.statValueAccent : null]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Styles — module scope (ADR-034)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: theme.colors.semantic.background
    },
    container: {
        padding: theme.spacing[5],
        paddingBottom: theme.spacing[10]
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
        marginBottom: theme.spacing[5]
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
    // Card
    card: {
        backgroundColor: theme.colors.neutral[50],
        borderRadius: theme.radius.semantic.card,
        padding: theme.spacing[5],
        marginBottom: theme.spacing[4],
        borderWidth: 1,
        borderColor: theme.colors.semantic.border
    },
    cardTitle: {
        fontSize: theme.typography.semantic.bodySm,
        fontWeight: '600',
        color: theme.colors.neutral[500],
        marginBottom: theme.spacing[3],
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    // Stats grid
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    statCell: {
        alignItems: 'center',
        flex: 1
    },
    statValue: {
        fontSize: theme.typography.semantic.h2,
        fontWeight: '700',
        color: theme.colors.neutral[700]
    },
    statValueAccent: {
        color: theme.colors.river[500]
    },
    statLabel: {
        fontSize: theme.typography.semantic.caption,
        color: theme.colors.neutral[500],
        marginTop: theme.spacing[1],
        textAlign: 'center'
    },
    // Big number (conversations)
    bigNumber: {
        fontSize: 48,
        fontWeight: '700',
        color: theme.colors.accent[500]
    },
    // Plan row
    planRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2]
    },
    planName: {
        fontSize: theme.typography.semantic.body,
        fontWeight: '600',
        color: theme.colors.neutral[700]
    },
    badge: {
        borderRadius: theme.radius.semantic.pill,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[1]
    },
    badgeActive: {
        backgroundColor: theme.colors.success[100]
    },
    badgeMuted: {
        backgroundColor: theme.colors.neutral[200]
    },
    badgeText: {
        fontSize: theme.typography.semantic.caption,
        fontWeight: '600',
        color: theme.colors.neutral[700]
    },
    badgeTextActive: {
        color: theme.colors.success[700]
    },
    mutedText: {
        fontSize: theme.typography.semantic.body,
        color: theme.colors.neutral[400]
    },
    // Metrics navigation row
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        backgroundColor: theme.colors.neutral[50],
        borderRadius: theme.radius.semantic.card,
        padding: theme.spacing[4],
        marginBottom: theme.spacing[4],
        borderWidth: 1,
        borderColor: theme.colors.semantic.border
    },
    metricsRowText: {
        fontSize: theme.typography.semantic.body,
        fontWeight: '600',
        color: theme.colors.river[600]
    }
});
