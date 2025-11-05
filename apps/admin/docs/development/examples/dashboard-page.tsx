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

import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  Activity,
  Plus,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  icon: typeof Plus;
  href: string;
  color: string;
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch dashboard statistics
 */
async function getDashboardStats(
  signal?: AbortSignal
): Promise<DashboardStats> {
  const response = await fetch('/api/v1/dashboard/stats', {
    signal,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }

  return response.json();
}

/**
 * Fetch recent activity
 */
async function getRecentActivity(
  limit: number = 10,
  signal?: AbortSignal
): Promise<ActivityItem[]> {
  const response = await fetch(
    `/api/v1/dashboard/activity?limit=${limit}`,
    {
      signal,
      credentials: 'include',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch recent activity');
  }

  return response.json();
}

/**
 * Fetch sales chart data
 */
async function getSalesChartData(
  signal?: AbortSignal
): Promise<SalesChartData> {
  const response = await fetch('/api/v1/dashboard/sales', {
    signal,
    credentials: 'include',
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
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
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
  formatValue = (v) => v.toLocaleString(),
}: {
  title: string;
  value: number;
  change: number;
  icon: typeof DollarSign;
  iconColor: string;
  formatValue?: (value: number) => string;
}) {
  const isPositive = change >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{formatValue(value)}</p>
            <div
              className={`flex items-center gap-1 text-sm ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              <TrendIcon className="h-4 w-4" />
              <span>
                {Math.abs(change).toFixed(1)}% from last month
              </span>
            </div>
          </div>
          <div
            className={`p-3 rounded-full ${iconColor}`}
          >
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
    refetchInterval: 60000, // Refetch every minute
  });

  if (error) {
    return (
      <Card className="col-span-4">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-red-600">Failed to load statistics</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error.message}
            </p>
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
        value={data!.totalRevenue}
        change={data!.revenueChange}
        icon={DollarSign}
        iconColor="bg-green-500"
        formatValue={(v) => `$${v.toLocaleString()}`}
      />
      <StatCard
        title="Orders"
        value={data!.totalOrders}
        change={data!.ordersChange}
        icon={ShoppingCart}
        iconColor="bg-blue-500"
      />
      <StatCard
        title="Products"
        value={data!.totalProducts}
        change={data!.productsChange}
        icon={Package}
        iconColor="bg-purple-500"
      />
      <StatCard
        title="Customers"
        value={data!.totalCustomers}
        change={data!.customersChange}
        icon={Users}
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
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="space-y-4">
      {data.map((point, index) => {
        const percentage = (point.value / maxValue) * 100;

        return (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{point.label}</span>
              <span className="text-muted-foreground">
                ${point.value.toLocaleString()}
              </span>
            </div>
            <div className="relative h-8 bg-muted rounded-md overflow-hidden">
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
    refetchInterval: 5 * 60000, // Refetch every 5 minutes
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
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-600">Failed to load sales data</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error.message}
            </p>
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
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-4 w-4" />;
      case 'product':
        return <Package className="h-4 w-4" />;
      case 'customer':
        return <Users className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
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
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-600">Failed to load activity</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error.message}
            </p>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No recent activity
          </div>
        )}

        {data && data.length > 0 && (
          <div className="space-y-4">
            {data.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-full ${getActivityColor(activity.type)}`}
                >
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
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
      icon: Package,
      href: '/products/new',
      color: 'bg-purple-500',
    },
    {
      label: 'New Order',
      description: 'Create a new order manually',
      icon: ShoppingCart,
      href: '/orders/new',
      color: 'bg-blue-500',
    },
    {
      label: 'New Customer',
      description: 'Add a new customer account',
      icon: Users,
      href: '/customers/new',
      color: 'bg-orange-500',
    },
    {
      label: 'View Reports',
      description: 'Access detailed analytics',
      icon: Activity,
      href: '/reports',
      color: 'bg-green-500',
    },
  ];

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <a
                key={action.label}
                href={action.href}
                className="group relative flex items-start gap-3 p-4 rounded-lg border bg-card transition-all hover:shadow-md hover:border-primary"
              >
                <div className={`p-2 rounded-lg ${action.color}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                    {action.label}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
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
    { id: '5', name: 'Pro Equipment', sales: 128, revenue: 6400 },
  ];

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Top Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topProducts.map((product, index) => (
            <div key={product.id} className="flex items-center gap-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-semibold text-sm">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {product.sales} sales
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  ${product.revenue.toLocaleString()}
                </p>
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your business.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardStats />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <SalesChart />
        <RecentActivity />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <QuickActions />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <TopProducts />

        {/* Placeholder for additional widgets */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Customer Satisfaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-4">
                <span className="text-4xl font-bold text-green-600">4.8</span>
              </div>
              <p className="text-sm text-muted-foreground">
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
  component: DashboardPage,
});
