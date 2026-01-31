/**
 * Billing Metrics - Usage Analytics Page
 *
 * Allows admins to search for customers and view their usage analytics.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    ApproachingLimitsTable,
    type CustomerSearchResult,
    SystemStatsCards,
    UsageDisplay,
    useApproachingLimitsQuery,
    useCustomerSearchQuery,
    useCustomerUsageQuery,
    useSystemUsageStatsQuery
} from '@/features/billing-metrics';
import { createFileRoute } from '@tanstack/react-router';
import { Search, User, X } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/metrics')({
    component: BillingMetricsPage
});

function BillingMetricsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

    // Fetch system-wide stats
    const {
        data: systemStats,
        isLoading: isLoadingStats,
        error: statsError
    } = useSystemUsageStatsQuery();

    // Fetch approaching limits
    const {
        data: approachingLimits,
        isLoading: isLoadingLimits,
        error: limitsError
    } = useApproachingLimitsQuery(90);

    // Search customers
    const {
        data: searchResults,
        isLoading: isSearching,
        error: searchError
    } = useCustomerSearchQuery(searchQuery);

    // Fetch usage for selected customer
    const {
        data: usageData,
        isLoading: isLoadingUsage,
        error: usageError
    } = useCustomerUsageQuery(selectedCustomer?.id || null);

    const handleSelectCustomer = (customer: CustomerSearchResult) => {
        setSelectedCustomer(customer);
        setSearchQuery(''); // Clear search when customer is selected
    };

    const handleClearSelection = () => {
        setSelectedCustomer(null);
        setSearchQuery('');
    };

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Analíticas de Uso</h2>
                    <p className="text-muted-foreground">
                        Estadísticas del sistema y uso de límites por cliente
                    </p>
                </div>

                {/* System Stats Cards */}
                {isLoadingStats ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <p className="mt-2 text-muted-foreground text-sm">
                                Cargando estadísticas...
                            </p>
                        </CardContent>
                    </Card>
                ) : statsError ? (
                    <Card className="border-destructive">
                        <CardContent className="py-8 text-center">
                            <p className="text-destructive text-sm">
                                Error al cargar estadísticas del sistema
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                {statsError.message}
                            </p>
                        </CardContent>
                    </Card>
                ) : systemStats && approachingLimits ? (
                    <SystemStatsCards
                        stats={systemStats}
                        approachingLimitsCount={approachingLimits.totalCustomers}
                    />
                ) : null}

                {/* Approaching Limits */}
                {isLoadingLimits ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <p className="mt-2 text-muted-foreground text-sm">
                                Cargando clientes cerca del límite...
                            </p>
                        </CardContent>
                    </Card>
                ) : limitsError ? (
                    <Card className="border-destructive">
                        <CardContent className="py-8 text-center">
                            <p className="text-destructive text-sm">
                                Error al cargar clientes cerca del límite
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                {limitsError.message}
                            </p>
                        </CardContent>
                    </Card>
                ) : approachingLimits ? (
                    <ApproachingLimitsTable data={approachingLimits} />
                ) : null}

                {/* Customer Search */}
                <Card>
                    <CardHeader>
                        <CardTitle>Buscar Cliente</CardTitle>
                        <CardDescription>
                            Ingresa el email del cliente para ver sus analíticas de uso
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Search input */}
                            <div className="relative">
                                <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    disabled={!!selectedCustomer}
                                    className="pl-9"
                                />
                                {selectedCustomer && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-translate-y-1/2 absolute top-1/2 right-2"
                                        onClick={handleClearSelection}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            {/* Selected customer */}
                            {selectedCustomer && (
                                <div className="rounded-lg border bg-muted/50 p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                                <User className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {selectedCustomer.email}
                                                </p>
                                                {selectedCustomer.name && (
                                                    <p className="text-muted-foreground text-sm">
                                                        {selectedCustomer.name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className="capitalize"
                                            >
                                                {selectedCustomer.category}
                                            </Badge>
                                            {selectedCustomer.planName && (
                                                <Badge>{selectedCustomer.planName}</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Search results dropdown */}
                            {!selectedCustomer &&
                                searchQuery.length >= 2 &&
                                (isSearching ? (
                                    <div className="py-4 text-center">
                                        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                        <p className="mt-2 text-muted-foreground text-sm">
                                            Buscando...
                                        </p>
                                    </div>
                                ) : searchError ? (
                                    <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                                        <p className="text-destructive text-sm">
                                            Error al buscar clientes
                                        </p>
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {searchError.message}
                                        </p>
                                    </div>
                                ) : searchResults && searchResults.length > 0 ? (
                                    <div className="space-y-2 rounded-lg border bg-card p-2">
                                        {searchResults.map((customer) => (
                                            <button
                                                key={customer.id}
                                                type="button"
                                                onClick={() => handleSelectCustomer(customer)}
                                                className="w-full rounded-md p-3 text-left transition-colors hover:bg-muted"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">
                                                            {customer.email}
                                                        </p>
                                                        {customer.name && (
                                                            <p className="text-muted-foreground text-sm">
                                                                {customer.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className="capitalize"
                                                        >
                                                            {customer.category}
                                                        </Badge>
                                                        {customer.planName && (
                                                            <Badge className="text-xs">
                                                                {customer.planName}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-4 text-center">
                                        <p className="text-muted-foreground text-sm">
                                            No se encontraron clientes
                                        </p>
                                    </div>
                                ))}

                            {/* Hint */}
                            {!selectedCustomer && searchQuery.length < 2 && (
                                <p className="text-muted-foreground text-sm">
                                    Ingresa al menos 2 caracteres para buscar
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Usage Display */}
                {selectedCustomer &&
                    (isLoadingUsage ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    Cargando analíticas de uso...
                                </p>
                            </CardContent>
                        </Card>
                    ) : usageError ? (
                        <Card className="border-destructive">
                            <CardContent className="py-12 text-center">
                                <p className="text-destructive">Error al cargar analíticas</p>
                                <p className="mt-2 text-muted-foreground text-sm">
                                    {usageError.message}
                                </p>
                            </CardContent>
                        </Card>
                    ) : usageData ? (
                        <UsageDisplay usage={usageData} />
                    ) : null)}

                {/* Empty state */}
                {!selectedCustomer && !searchQuery && (
                    <Card className="border-dashed">
                        <CardContent className="py-12 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                <Search className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground">
                                Busca un cliente para ver sus analíticas de uso
                            </p>
                            <p className="mt-2 text-muted-foreground text-sm">
                                Utiliza el campo de búsqueda para encontrar un cliente por email
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </SidebarPageLayout>
    );
}
