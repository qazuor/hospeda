/**
 * Dashboard Page Example
 *
 * This file demonstrates a complete dashboard with:
 * - Multiple data sources with parallel queries
 * - Summary cards (KPIs)
 * - Charts/graphs visualization
 * - Recent activity list
 * - Quick actions
 * - Real-time data with auto-refetch
 * - Loading skeletons
 * - Error boundaries
 * - Responsive grid layout
 *
 * Copy-paste ready code that follows Hospeda Admin patterns.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ActivityIcon,
    type AddIcon,
    DollarSignIcon,
    EyeIcon,
    PackageIcon,
    ShoppingCartIcon,
    TrendingDownIcon,
    TrendingUpIcon,
    UsersIcon
} from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

// ============================================================================
// Types
// ============================================================================

/**
 * Dashboard statistics
 */
type DashboardStats = {
    totalRevenue: number;
    revenueChange: number;
    totalOrders: number;
    ordersChange: number;
    totalProducts: number;
    productsChange: number;
    totalCustomers: number;
    customersChange: number;
};

/**
 * Recent activity item
 */
type ActivityItem = {
    id: string;
    type: 'order' | 'product' | 'customer';
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
};

/**
 * Chart data point
 */
type ChartDataPoint = {
    date: string;
    value: number;
    label: string;
};

/**
 * Sales chart data
 */
type SalesChartData = {
    daily: ChartDataPoint[];
    weekly: ChartDataPoint[];
    monthly: ChartDataPoint[];
};

/**
 * Quick action
 */
type QuickAction = {
    label: string;
    description: string;
    icon: typeof AddIcon;
    href: string;
    color: string;
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch dashboard statistics
 */
async function getDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
    const response = await fetch('/api/v1/dashboard/stats', {
        signal,
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
    }

    return response.json();
}

/**
 * Fetch recent activity
 */
async function getRecentActivity(limit = 10, signal?: AbortSignal): Promise<ActivityItem[]> {
    const response = await fetch(`/api/v1/dashboard/activity?limit=${limit}`, {
        signal,
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to fetch recent activity');
    }

    return response.json();
}

/**
 * Fetch sales chart data
 */
async function getSalesChartData(signal?: AbortSignal): Promise<SalesChartData> {
    const response = await fetch('/api/v1/dashboard/sales', {
        signal,
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to fetch sales data');
    }

    return response.json();
}

// ============================================================================
// Components
// ============================================================================

/**
 * Loading skeleton for stat card
 */
function StatCardSkeleton() {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="space-y-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-8 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Statistic card component with trend indicator
 */
function StatCard({
    title,
    value,
    change,
    icon: Icon,
    iconColor,
    formatValue = (v) => v.toLocaleString()
}: {
    title: string;
    value: number;
    change: number;
    icon: typeof DollarSignIcon;
    iconColor: string;
    formatValue?: (value: number) => string;
}) {
    const isPositive = change >= 0;
    const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon;

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="font-medium text-muted-foreground text-sm">{title}</p>
                        <p className="font-bold text-3xl">{formatValue(value)}</p>
                        <div
                            className={`flex items-center gap-1 text-sm ${
                                isPositive ? 'text-green-600' : 'text-red-600'
                            }`}
                        >
                            <TrendIcon className="h-4 w-4" />
                            <span>{Math.abs(change).toFixed(1)}% from last month</span>
                        </div>
                    </div>
                    <div className={`rounded-full p-3 ${iconColor}`}>
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Dashboard statistics grid
 */
function DashboardStats() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['dashboard', 'stats'],
        queryFn: ({ signal }) => getDashboardStats(signal),
        refetchInterval: 60000 // Refetch every minute
    });

    if (error) {
        return (
            <Card className="col-span-4">
                <CardContent className="pt-6">
                    <div className="py-8 text-center">
                        <p className="text-red-600">Failed to load statistics</p>
                        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
            </>
        );
    }

    return (
        <>
            <StatCard
                title="Total Revenue"
                value={data?.totalRevenue}
                change={data?.revenueChange}
                icon={DollarSignIcon}
                iconColor="bg-green-500"
                formatValue={(v) => `$${v.toLocaleString()}`}
            />
            <StatCard
                title="Orders"
                value={data?.totalOrders}
                change={data?.ordersChange}
                icon={ShoppingCartIcon}
                iconColor="bg-blue-500"
            />
            <StatCard
                title="Products"
                value={data?.totalProducts}
                change={data?.productsChange}
                icon={PackageIcon}
                iconColor="bg-purple-500"
            />
            <StatCard
                title="Customers"
                value={data?.totalCustomers}
                change={data?.customersChange}
                icon={UsersIcon}
                iconColor="bg-orange-500"
            />
        </>
    );
}

/**
 * Simple bar chart component (can be replaced with recharts or other library)
 */
function SimpleBarChart({ data }: { data: ChartDataPoint[] }) {
    if (!data || data.length === 0) {
        return <div className="py-8 text-center text-muted-foreground">No data available</div>;
    }

    const maxValue = Math.max(...data.map((d) => d.value));

    return (
        <div className="space-y-4">
            {data.map((point) => {
                const percentage = (point.value / maxValue) * 100;

                return (
                    <div
                        key={point.label}
                        className="space-y-1"
                    >
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{point.label}</span>
                            <span className="text-muted-foreground">
                                ${point.value.toLocaleString()}
                            </span>
                        </div>
                        <div className="relative h-8 overflow-hidden rounded-md bg-muted">
                            <div
                                className="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Sales chart card
 */
function SalesChart() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['dashboard', 'sales'],
        queryFn: ({ signal }) => getSalesChartData(signal),
        refetchInterval: 5 * 60000 // Refetch every 5 minutes
    });

    return (
        <Card className="col-span-2">
            <CardHeader>
                <CardTitle>Sales Overview</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="space-y-2"
                            >
                                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                                <div className="h-8 animate-pulse rounded bg-muted" />
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="py-8 text-center">
                        <p className="text-red-600">Failed to load sales data</p>
                        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
                    </div>
                )}

                {data && <SimpleBarChart data={data.weekly} />}
            </CardContent>
        </Card>
    );
}

/**
 * Recent activity card
 */
function RecentActivity() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['dashboard', 'activity'],
        queryFn: ({ signal }) => getRecentActivity(10, signal),
        refetchInterval: 30000 // Refetch every 30 seconds
    });

    const getActivityIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'order':
                return <ShoppingCartIcon className="h-4 w-4" />;
            case 'product':
                return <PackageIcon className="h-4 w-4" />;
            case 'customer':
                return <UsersIcon className="h-4 w-4" />;
            default:
                return <ActivityIcon className="h-4 w-4" />;
        }
    };

    const getActivityColor = (type: ActivityItem['type']) => {
        switch (type) {
            case 'order':
                return 'bg-blue-100 text-blue-600';
            case 'product':
                return 'bg-purple-100 text-purple-600';
            case 'customer':
                return 'bg-orange-100 text-orange-600';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    return (
        <Card className="col-span-2">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Recent Activity</CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                    >
                        <EyeIcon className="mr-2 h-4 w-4" />
                        View All
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="flex items-start gap-3"
                            >
                                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 animate-pulse rounded bg-muted" />
                                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="py-8 text-center">
                        <p className="text-red-600">Failed to load activity</p>
                        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
                    </div>
                )}

                {data && data.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">No recent activity</div>
                )}

                {data && data.length > 0 && (
                    <div className="space-y-4">
                        {data.map((activity) => (
                            <div
                                key={activity.id}
                                className="flex items-start gap-3"
                            >
                                <div
                                    className={`rounded-full p-2 ${getActivityColor(activity.type)}`}
                                >
                                    {getActivityIcon(activity.type)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 text-sm">
                                        {activity.description}
                                    </p>
                                    <p className="mt-1 text-muted-foreground text-xs">
                                        {formatTimestamp(activity.timestamp)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Quick actions card
 */
function QuickActions() {
    const actions: QuickAction[] = [
        {
            label: 'New Product',
            description: 'Add a new product to your catalog',
            icon: PackageIcon,
            href: '/products/new',
            color: 'bg-purple-500'
        },
        {
            label: 'New Order',
            description: 'Create a new order manually',
            icon: ShoppingCartIcon,
            href: '/orders/new',
            color: 'bg-blue-500'
        },
        {
            label: 'New Customer',
            description: 'Add a new customer account',
            icon: UsersIcon,
            href: '/customers/new',
            color: 'bg-orange-500'
        },
        {
            label: 'View Reports',
            description: 'Access detailed analytics',
            icon: ActivityIcon,
            href: '/reports',
            color: 'bg-green-500'
        }
    ];

    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {actions.map((action) => {
                        const Icon = action.icon;

                        return (
                            <a
                                key={action.label}
                                href={action.href}
                                className="group relative flex items-start gap-3 rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
                            >
                                <div className={`rounded-lg p-2 ${action.color}`}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-sm transition-colors group-hover:text-primary">
                                        {action.label}
                                    </h4>
                                    <p className="mt-1 text-muted-foreground text-xs">
                                        {action.description}
                                    </p>
                                </div>
                            </a>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Top products card
 */
function TopProducts() {
    // This would typically fetch from an API
    // For demo purposes, using static data
    const topProducts = [
        { id: '1', name: 'Premium Widget', sales: 234, revenue: 11700 },
        { id: '2', name: 'Deluxe Gadget', sales: 189, revenue: 9450 },
        { id: '3', name: 'Standard Tool', sales: 156, revenue: 4680 },
        { id: '4', name: 'Basic Device', sales: 143, revenue: 2860 },
        { id: '5', name: 'Pro Equipment', sales: 128, revenue: 6400 }
    ];

    return (
        <Card className="col-span-2">
            <CardHeader>
                <CardTitle>Top Products</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {topProducts.map((product, index) => (
                        <div
                            key={product.id}
                            className="flex items-center gap-4"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-semibold text-sm">
                                {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{product.name}</p>
                                <p className="text-muted-foreground text-sm">
                                    {product.sales} sales
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold">${product.revenue.toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Main dashboard page component
 */
function DashboardPage() {
    return (
        <div className="container mx-auto space-y-6 p-6">
            {/* Header */}
            <div>
                <h1 className="font-bold text-3xl">Dashboard</h1>
                <p className="text-muted-foreground">
                    Welcome back! Here's an overview of your business.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <DashboardStats />
            </div>

            {/* Charts and Activity */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <SalesChart />
                <RecentActivity />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <QuickActions />
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <TopProducts />

                {/* Placeholder for additional widgets */}
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Customer Satisfaction</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="py-12 text-center">
                            <div className="mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
                                <span className="font-bold text-4xl text-green-600">4.8</span>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                Average rating from 1,234 reviews
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Route Definition
// ============================================================================

/**
 * Dashboard route with authentication
 */
export const Route = createFileRoute('/_authed/dashboard')({
    component: DashboardPage
});
