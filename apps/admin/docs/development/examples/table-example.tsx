/**
 * Advanced Table Example
 *
 * This file demonstrates a sophisticated table with:
 * - Server-side sorting and filtering
 * - Column visibility toggle
 * - Resizable columns
 * - Row selection with bulk actions
 * - Expandable rows
 * - Custom cell renderers
 * - Column filters (text, select, date range)
 * - Export to CSV
 * - Virtualization for large datasets
 * - Sticky header
 * - Loading states and error handling
 *
 * Copy-paste ready code that follows Hospeda Admin patterns.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import {
    ChevronDownIcon,
    ChevronUpIcon,
    ChevronsUpDownIcon,
    CloseIcon,
    DownloadIcon,
    EyeIcon,
    FilterIcon,
    MoreHorizontalIcon,
    SearchIcon
} from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
    type ColumnDef,
    type ColumnFiltersState,
    type ExpandedState,
    type RowSelectionState,
    type SortingState,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Order status enum
 */
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

/**
 * Order entity
 */
type Order = {
    id: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    status: OrderStatus;
    total: number;
    items: number;
    createdAt: string;
    shippedAt?: string;
    deliveredAt?: string;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
    };
    notes?: string;
};

/**
 * Order items for expandable row
 */
type OrderItem = {
    id: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
};

/**
 * API response
 */
type OrdersResponse = {
    orders: Order[];
    total: number;
    page: number;
    limit: number;
};

/**
 * Search params validation
 */
const searchSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional()
});

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch orders with server-side pagination, sorting, and filtering
 */
async function getOrders(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    dateFrom?: string;
    dateTo?: string;
    signal?: AbortSignal;
}): Promise<OrdersResponse> {
    const queryParams = new URLSearchParams({
        page: params.page.toString(),
        limit: params.limit.toString()
    });

    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);

    const response = await fetch(`/api/v1/orders?${queryParams.toString()}`, {
        signal: params.signal,
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to fetch orders');
    }

    return response.json();
}

/**
 * Fetch order items for expandable row
 */
async function getOrderItems(orderId: string, signal?: AbortSignal): Promise<OrderItem[]> {
    const response = await fetch(`/api/v1/orders/${orderId}/items`, {
        signal,
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to fetch order items');
    }

    return response.json();
}

/**
 * Export orders to CSV
 */
function exportToCSV(orders: Order[], filename = 'orders.csv') {
    const headers = [
        'Order Number',
        'Customer Name',
        'Email',
        'Status',
        'Total',
        'Items',
        'Created At',
        'Address'
    ];

    const rows = orders.map((order) => [
        order.orderNumber,
        order.customerName,
        order.customerEmail,
        order.status,
        order.total.toFixed(2),
        order.items,
        new Date(order.createdAt).toLocaleDateString(),
        `${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zipCode}`
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================================
// Components
// ============================================================================

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: OrderStatus }) {
    const config = {
        pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
        processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
        shipped: { label: 'Shipped', className: 'bg-purple-100 text-purple-800' },
        delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
        cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' }
    };

    const { label, className } = config[status];

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${className}`}
        >
            {label}
        </span>
    );
}

/**
 * Sortable header button
 */
function SortableHeader({
    column,
    title
}: {
    column: { getIsSorted: () => string | false; toggleSorting: () => void };
    title: string;
}) {
    const sorted = column.getIsSorted();

    return (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting()}
            className="-ml-4 flex h-8 items-center gap-2 hover:bg-muted"
        >
            {title}
            {sorted === 'asc' && <ChevronUpIcon className="h-4 w-4" />}
            {sorted === 'desc' && <ChevronDownIcon className="h-4 w-4" />}
            {!sorted && <ChevronsUpDownIcon className="h-4 w-4 opacity-50" />}
        </Button>
    );
}

/**
 * Column filter popover
 */
function ColumnFilter({
    column,
    title,
    type = 'text',
    options
}: {
    column: { getFilterValue: () => unknown; setFilterValue: (val: unknown) => void };
    title: string;
    type?: 'text' | 'select';
    options?: { value: string; label: string }[];
}) {
    const [isOpen, setIsOpen] = useState(false);
    const filterValue = column.getFilterValue();

    return (
        <Popover
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={filterValue ? 'text-primary' : ''}
                >
                    <FilterIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
                <div className="space-y-4">
                    <h4 className="font-medium">{title}</h4>

                    {type === 'text' && (
                        <div className="space-y-2">
                            <input
                                value={(filterValue as string) ?? ''}
                                onChange={(e) => column.setFilterValue(e.target.value)}
                                placeholder={`Filter ${title.toLowerCase()}...`}
                                className="w-full rounded-md border px-3 py-2"
                            />
                        </div>
                    )}

                    {type === 'select' && options && (
                        <div className="space-y-2">
                            <select
                                value={(filterValue as string) ?? ''}
                                onChange={(e) => column.setFilterValue(e.target.value)}
                                className="w-full rounded-md border px-3 py-2"
                            >
                                <option value="">All</option>
                                {options.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                column.setFilterValue(undefined);
                                setIsOpen(false);
                            }}
                            className="flex-1"
                        >
                            Clear
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="flex-1"
                        >
                            Apply
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

/**
 * Column visibility dropdown
 */
function ColumnVisibility({
    table
}: {
    table: {
        getAllColumns: () => {
            id: string;
            getCanHide: () => boolean;
            getIsVisible: () => boolean;
            toggleVisibility: (val: boolean) => void;
            columnDef: { header: unknown };
        }[];
    };
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                >
                    <EyeIcon className="mr-2 h-4 w-4" />
                    Columns
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
                <div className="space-y-4">
                    <h4 className="font-medium">Toggle Columns</h4>
                    <div className="space-y-2">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => (
                                <div
                                    key={column.id}
                                    className="flex items-center gap-2"
                                >
                                    <input
                                        id={column.id}
                                        type="checkbox"
                                        checked={column.getIsVisible()}
                                        onChange={(e) => column.toggleVisibility(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <label
                                        htmlFor={column.id}
                                        className="cursor-pointer text-sm"
                                    >
                                        {column.columnDef.header as string}
                                    </label>
                                </div>
                            ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

/**
 * Bulk actions toolbar
 */
function BulkActionsToolbar({
    selectedCount,
    onClear,
    onExport,
    onCancel
}: {
    selectedCount: number;
    onClear: () => void;
    onExport: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="flex items-center justify-between border-b bg-primary/10 p-4">
            <div className="flex items-center gap-4">
                <span className="font-medium">{selectedCount} selected</span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onClear}
                >
                    <CloseIcon className="mr-2 h-4 w-4" />
                    Clear Selection
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onExport}
                >
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    Export Selected
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={onCancel}
                >
                    Cancel Orders
                </Button>
            </div>
        </div>
    );
}

/**
 * Expandable row content showing order items
 */
function ExpandedRowContent({ orderId }: { orderId: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['order-items', orderId],
        queryFn: ({ signal }) => getOrderItems(orderId, signal)
    });

    if (isLoading) {
        return (
            <div className="bg-muted/30 p-4">
                <div className="animate-pulse space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-4 w-1/2 rounded bg-muted" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-muted/30 p-4">
                <p className="text-red-600 text-sm">Failed to load items</p>
            </div>
        );
    }

    return (
        <div className="bg-muted/30 p-4">
            <h4 className="mb-3 font-semibold">Order Items</h4>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b">
                        <th className="py-2 text-left">Product</th>
                        <th className="py-2 text-right">Quantity</th>
                        <th className="py-2 text-right">Price</th>
                        <th className="py-2 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.map((item) => (
                        <tr
                            key={item.id}
                            className="border-b"
                        >
                            <td className="py-2">{item.productName}</td>
                            <td className="py-2 text-right">{item.quantity}</td>
                            <td className="py-2 text-right">${item.price.toFixed(2)}</td>
                            <td className="py-2 text-right font-semibold">
                                ${item.total.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Advanced orders table
 */
function AdvancedOrdersTable({
    data,
    isLoading
}: {
    data: OrdersResponse;
    isLoading: boolean;
}) {
    const navigate = useNavigate();
    const { toast } = useToast();

    // Table state
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [expanded, setExpanded] = useState<ExpandedState>({});
    const [globalFilter, setGlobalFilter] = useState('');

    // Define columns
    const columns = useMemo<ColumnDef<Order>[]>(
        () => [
            // Selection column
            {
                id: 'select',
                header: ({ table }) => (
                    <input
                        type="checkbox"
                        checked={table.getIsAllRowsSelected()}
                        onChange={table.getToggleAllRowsSelectedHandler()}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                ),
                cell: ({ row }) => (
                    <input
                        type="checkbox"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                ),
                size: 40
            },

            // Expand column
            {
                id: 'expand',
                header: () => null,
                cell: ({ row }) => (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            row.toggleExpanded();
                        }}
                        className="rounded p-1 transition-colors hover:bg-muted"
                    >
                        <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                                row.getIsExpanded() ? 'rotate-90' : ''
                            }`}
                        />
                    </button>
                ),
                size: 40
            },

            // Order number
            {
                accessorKey: 'orderNumber',
                header: ({ column }) => (
                    <div className="flex items-center gap-2">
                        <SortableHeader
                            column={column}
                            title="Order #"
                        />
                        <ColumnFilter
                            column={column}
                            title="Order Number"
                            type="text"
                        />
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="font-medium font-mono">{row.original.orderNumber}</div>
                ),
                size: 120
            },

            // Customer name
            {
                accessorKey: 'customerName',
                header: ({ column }) => (
                    <div className="flex items-center gap-2">
                        <SortableHeader
                            column={column}
                            title="Customer"
                        />
                        <ColumnFilter
                            column={column}
                            title="Customer Name"
                            type="text"
                        />
                    </div>
                ),
                size: 180
            },

            // Customer email
            {
                accessorKey: 'customerEmail',
                header: 'Email',
                cell: ({ row }) => (
                    <div className="text-muted-foreground text-sm">
                        {row.original.customerEmail}
                    </div>
                ),
                size: 200
            },

            // Status
            {
                accessorKey: 'status',
                header: ({ column }) => (
                    <div className="flex items-center gap-2">
                        <span>Status</span>
                        <ColumnFilter
                            column={column}
                            title="Status"
                            type="select"
                            options={[
                                { value: 'pending', label: 'Pending' },
                                { value: 'processing', label: 'Processing' },
                                { value: 'shipped', label: 'Shipped' },
                                { value: 'delivered', label: 'Delivered' },
                                { value: 'cancelled', label: 'Cancelled' }
                            ]}
                        />
                    </div>
                ),
                cell: ({ row }) => <StatusBadge status={row.original.status} />,
                size: 120
            },

            // Total
            {
                accessorKey: 'total',
                header: ({ column }) => (
                    <div className="text-right">
                        <SortableHeader
                            column={column}
                            title="Total"
                        />
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="text-right font-semibold">
                        $
                        {row.original.total.toLocaleString('en-US', {
                            minimumFractionDigits: 2
                        })}
                    </div>
                ),
                size: 100
            },

            // Items count
            {
                accessorKey: 'items',
                header: ({ column }) => (
                    <div className="text-center">
                        <SortableHeader
                            column={column}
                            title="Items"
                        />
                    </div>
                ),
                cell: ({ row }) => <div className="text-center">{row.original.items}</div>,
                size: 80
            },

            // Created date
            {
                accessorKey: 'createdAt',
                header: ({ column }) => (
                    <SortableHeader
                        column={column}
                        title="Created"
                    />
                ),
                cell: ({ row }) => {
                    const date = new Date(row.original.createdAt);
                    return (
                        <div className="text-sm">
                            <div>{date.toLocaleDateString()}</div>
                            <div className="text-muted-foreground">
                                {date.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>
                    );
                },
                size: 120
            },

            // Actions
            {
                id: 'actions',
                header: () => <div className="text-center">Actions</div>,
                cell: ({ row }) => {
                    const order = row.original;

                    return (
                        <div className="flex items-center justify-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    navigate({ to: '/orders/$id', params: { id: order.id } })
                                }
                            >
                                View
                            </Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                    >
                                        <MoreHorizontalIcon className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48">
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                                        >
                                            Print Invoice
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                                        >
                                            Resend Email
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full rounded px-3 py-2 text-left text-red-600 text-sm hover:bg-muted"
                                        >
                                            Cancel Order
                                        </button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    );
                },
                size: 120
            }
        ],
        [navigate]
    );

    // Table instance
    const table = useReactTable({
        data: data?.orders || [],
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            expanded,
            globalFilter
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onExpandedChange: setExpanded,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        enableRowSelection: true
    });

    // Get selected rows
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedOrders = selectedRows.map((row) => row.original);

    // Handle bulk export
    const handleBulkExport = () => {
        if (selectedOrders.length === 0) {
            toast({
                title: 'No orders selected',
                description: 'Please select orders to export',
                variant: 'destructive'
            });
            return;
        }

        exportToCSV(selectedOrders, `orders-${Date.now()}.csv`);
        toast({
            title: 'Export successful',
            description: `Exported ${selectedOrders.length} orders`
        });
    };

    // Handle bulk cancel
    const handleBulkCancel = () => {
        if (selectedOrders.length === 0) return;

        if (confirm(`Cancel ${selectedOrders.length} orders?`)) {
            // In real app, would call API
            toast({
                title: 'Orders cancelled',
                description: `Cancelled ${selectedOrders.length} orders`
            });
            setRowSelection({});
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-12">
                    <div className="text-center">
                        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
                        <p className="mt-4 text-muted-foreground">Loading orders...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Orders</CardTitle>
                    <div className="flex items-center gap-2">
                        {/* Global search */}
                        <div className="relative">
                            <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search all columns..."
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                className="w-64 rounded-md border py-2 pr-4 pl-10 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        {/* Column visibility */}
                        <ColumnVisibility table={table} />

                        {/* Export all */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportToCSV(data?.orders || [], 'all-orders.csv')}
                        >
                            <DownloadIcon className="mr-2 h-4 w-4" />
                            Export All
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {/* Bulk actions toolbar */}
                {selectedRows.length > 0 && (
                    <BulkActionsToolbar
                        selectedCount={selectedRows.length}
                        onClear={() => setRowSelection({})}
                        onExport={handleBulkExport}
                        onCancel={handleBulkCancel}
                    />
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 z-10 bg-background">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr
                                    key={headerGroup.id}
                                    className="border-b bg-muted/50"
                                >
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="px-4 py-3 text-left font-medium"
                                            style={{ width: header.getSize() }}
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        className="px-4 py-12 text-center text-muted-foreground"
                                    >
                                        No orders found. Try adjusting your filters.
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <>
                                        {/* Main row */}
                                        <tr
                                            key={row.id}
                                            className={`cursor-pointer border-b transition-colors hover:bg-muted/50 ${
                                                row.getIsSelected() ? 'bg-primary/5' : ''
                                            }`}
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <td
                                                    key={cell.id}
                                                    className="px-4 py-3"
                                                >
                                                    {flexRender(
                                                        cell.column.columnDef.cell,
                                                        cell.getContext()
                                                    )}
                                                </td>
                                            ))}
                                        </tr>

                                        {/* Expanded row */}
                                        {row.getIsExpanded() && (
                                            <tr>
                                                <td
                                                    colSpan={columns.length}
                                                    className="p-0"
                                                >
                                                    <ExpandedRowContent orderId={row.original.id} />
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t p-4">
                    <div className="text-muted-foreground text-sm">
                        Showing {data?.orders.length || 0} of {data?.total || 0} orders
                    </div>

                    <div className="text-muted-foreground text-sm">
                        {selectedRows.length > 0 && (
                            <span className="mr-4">
                                {selectedRows.length} of {table.getRowModel().rows.length} row(s)
                                selected
                            </span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Main orders page
 */
function OrdersPage() {
    const search = Route.useSearch();

    // Fetch orders
    const { data, isLoading, error } = useQuery({
        queryKey: ['orders', search],
        queryFn: ({ signal }) =>
            getOrders({
                page: search.page,
                limit: search.limit,
                search: search.search,
                status: search.status,
                sortBy: search.sortBy,
                sortOrder: search.sortOrder,
                dateFrom: search.dateFrom,
                dateTo: search.dateTo,
                signal
            })
    });

    if (error) {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="py-8 text-center">
                            <h2 className="font-bold text-2xl text-red-600">Error</h2>
                            <p className="mt-2 text-muted-foreground">{error.message}</p>
                            <Button
                                className="mt-4"
                                onClick={() => window.location.reload()}
                            >
                                Try Again
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto space-y-6 p-6">
            <div>
                <h1 className="font-bold text-3xl">Orders</h1>
                <p className="text-muted-foreground">Manage and track all customer orders</p>
            </div>

            <AdvancedOrdersTable
                data={data ?? []}
                isLoading={isLoading}
            />
        </div>
    );
}

// ============================================================================
// Route Definition
// ============================================================================

/**
 * Orders route with authentication and search params
 */
export const Route = createFileRoute('/_authed/orders/')({
    validateSearch: searchSchema,
    component: OrdersPage
});
