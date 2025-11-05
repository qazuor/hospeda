# Tables Guide

Complete guide to building data tables with TanStack Table in the Hospeda Admin Dashboard.

---

## 📖 Overview

TanStack Table is a **headless UI library** for building powerful data tables. It provides the logic for tables while you provide the UI, giving you complete control over styling and behavior.

**What you'll learn:**

- Table setup and configuration
- Column definitions
- Sorting and filtering
- Pagination patterns
- Row selection
- Custom cell renderers
- Server-side vs client-side tables
- Performance optimization

**Prerequisites:**

- Understanding of React components
- Basic TypeScript knowledge
- Read [Creating Pages Tutorial](./creating-pages.md)

---

## 🚀 Quick Start

### Basic Table Example

```tsx
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'price',
    header: 'Price',
    cell: ({ row }) => `$${row.original.price.toFixed(2)}`,
  },
  {
    accessorKey: 'stock',
    header: 'Stock',
  },
];

function ProductsTable({ data }: { data: Product[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
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
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 🏗️ Table Setup

### Creating a Table

Use `useReactTable` hook to create a table instance:

```tsx
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table';

type User = {
  id: string;
  name: string;
  email: string;
};

const columns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
];

function UsersTable({ data }: { data: User[] }) {
  const table = useReactTable({
    data,           // Your data array
    columns,        // Column definitions
    getCoreRowModel: getCoreRowModel(), // Required
  });

  return (
    <table>
      {/* Render table */}
    </table>
  );
}
```

### Table Options

```tsx
const table = useReactTable({
  // Required
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),

  // Optional features
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),

  // State management
  state: {
    sorting,
    filtering,
    pagination,
  },

  // Event handlers
  onSortingChange: setSorting,
  onFilteringChange: setFiltering,
  onPaginationChange: setPagination,

  // Configuration
  enableSorting: true,
  enableFiltering: true,
  manualPagination: false,
});
```

---

## 📊 Column Definitions

### Basic Columns

```tsx
import type { ColumnDef } from '@tanstack/react-table';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isActive: boolean;
};

const columns: ColumnDef<Product>[] = [
  {
    // Simple accessor
    accessorKey: 'name',
    header: 'Product Name',
  },
  {
    // Accessor with custom cell
    accessorKey: 'price',
    header: 'Price',
    cell: ({ getValue }) => {
      const price = getValue<number>();
      return `$${price.toFixed(2)}`;
    },
  },
  {
    // Accessor function
    accessorFn: (row) => `${row.name} (${row.category})`,
    header: 'Product Info',
  },
];
```

### Custom Header

```tsx
const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <button
          onClick={() => column.toggleSorting()}
          className="flex items-center gap-2"
        >
          Product Name
          {column.getIsSorted() === 'asc' && <ChevronUp />}
          {column.getIsSorted() === 'desc' && <ChevronDown />}
        </button>
      );
    },
  },
];
```

### Custom Cell Renderers

```tsx
const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const isActive = row.original.isActive;
      return (
        <span
          className={`px-2 py-1 rounded ${
            isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>
      );
    },
  },
  {
    accessorKey: 'price',
    header: 'Price',
    cell: ({ row }) => {
      const price = row.original.price;
      return (
        <div className="text-right font-mono">
          ${price.toFixed(2)}
        </div>
      );
    },
  },
];
```

### Action Column

```tsx
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

const columns: ColumnDef<Product>[] = [
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const product = row.original;

      return (
        <div className="flex gap-2">
          <Link to="/products/$id" params={{ id: product.id }}>
            <Button variant="outline" size="sm">
              View
            </Button>
          </Link>
          <Link to="/products/$id/edit" params={{ id: product.id }}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDelete(product.id)}
          >
            Delete
          </Button>
        </div>
      );
    },
  },
];
```

---

## 🔄 Sorting

### Client-Side Sorting

```tsx
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

function SortableTable({ data }: { data: Product[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting()}>
          Name {column.getIsSorted() === 'asc' ? '↑' : column.getIsSorted() === 'desc' ? '↓' : ''}
        </button>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'price',
      header: 'Price',
      enableSorting: true,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table>
      {/* Render table */}
    </table>
  );
}
```

### Sortable Header Component

Create reusable sortable header:

```tsx
// components/SortableHeader.tsx
import { Column } from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SortableHeaderProps<T> = {
  column: Column<T>;
  title: string;
};

export function SortableHeader<T>({
  column,
  title,
}: SortableHeaderProps<T>) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting()}
      className="flex items-center gap-2"
    >
      {title}
      {sorted === 'asc' && <ChevronUp className="h-4 w-4" />}
      {sorted === 'desc' && <ChevronDown className="h-4 w-4" />}
      {!sorted && <ChevronsUpDown className="h-4 w-4" />}
    </Button>
  );
}
```

**Usage:**

```tsx
const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <SortableHeader column={column} title="Product Name" />
    ),
  },
];
```

### Multi-Column Sorting

```tsx
const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  enableMultiSort: true, // Enable multi-column sorting
});

// To sort by multiple columns, hold Shift while clicking headers
```

---

## 🔍 Filtering

### Global Filter

```tsx
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table';

function FilterableTable({ data }: { data: Product[] }) {
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      {/* Search input */}
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Search all columns..."
        className="mb-4 px-3 py-2 border rounded"
      />

      <table>
        {/* Render table */}
      </table>
    </div>
  );
}
```

### Column Filter

```tsx
import type { ColumnDef } from '@tanstack/react-table';

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'category',
    header: 'Category',
    filterFn: 'equals',
  },
  {
    accessorKey: 'name',
    header: 'Name',
    filterFn: 'includesString', // Default
  },
];

// In component
function ProductsTable({ data }: { data: Product[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      {/* Category filter */}
      <select
        value={(table.getColumn('category')?.getFilterValue() as string) ?? ''}
        onChange={(e) =>
          table.getColumn('category')?.setFilterValue(e.target.value)
        }
      >
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
      </select>

      <table>
        {/* Render table */}
      </table>
    </div>
  );
}
```

### Custom Filter Function

```tsx
const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'price',
    header: 'Price',
    filterFn: (row, columnId, filterValue) => {
      const price = row.getValue<number>(columnId);
      const [min, max] = filterValue as [number, number];

      if (min !== undefined && price < min) return false;
      if (max !== undefined && price > max) return false;

      return true;
    },
  },
];

// Usage
<div>
  <input
    type="number"
    placeholder="Min price"
    onChange={(e) => {
      const value = [parseFloat(e.target.value), undefined];
      table.getColumn('price')?.setFilterValue(value);
    }}
  />
  <input
    type="number"
    placeholder="Max price"
    onChange={(e) => {
      const existing = table.getColumn('price')?.getFilterValue() as [number, number];
      const value = [existing?.[0], parseFloat(e.target.value)];
      table.getColumn('price')?.setFilterValue(value);
    }}
  />
</div>
```

---

## 📄 Pagination

### Client-Side Pagination

```tsx
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';

function PaginatedTable({ data }: { data: Product[] }) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <table>
        {/* Render table */}
      </table>

      {/* Pagination controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            data.length
          )}{' '}
          of {data.length} results
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Page Size Selector

```tsx
<select
  value={table.getState().pagination.pageSize}
  onChange={(e) => {
    table.setPageSize(Number(e.target.value));
  }}
>
  {[10, 20, 50, 100].map((pageSize) => (
    <option key={pageSize} value={pageSize}>
      Show {pageSize}
    </option>
  ))}
</select>
```

### Server-Side Pagination

```tsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

function ServerPaginatedTable() {
  const navigate = useNavigate();
  const search = Route.useSearch(); // { page: number, limit: number }

  // Fetch data with pagination params
  const { data, isLoading } = useQuery({
    queryKey: ['products', search.page, search.limit],
    queryFn: () =>
      getProducts({
        page: search.page,
        limit: search.limit,
      }),
  });

  const table = useReactTable({
    data: data?.products ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // Important!
    pageCount: data?.totalPages ?? 0,
    state: {
      pagination: {
        pageIndex: search.page - 1,
        pageSize: search.limit,
      },
    },
  });

  const changePage = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
    });
  };

  return (
    <div>
      <table>
        {/* Render table */}
      </table>

      {/* Pagination controls */}
      <div className="flex gap-2">
        <button
          onClick={() => changePage(search.page - 1)}
          disabled={search.page === 1}
        >
          Previous
        </button>
        <span>
          Page {search.page} of {data?.totalPages}
        </span>
        <button
          onClick={() => changePage(search.page + 1)}
          disabled={search.page === data?.totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## ✅ Row Selection

### Enable Row Selection

```tsx
import { useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';

function SelectableTable({ data }: { data: Product[] }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns: ColumnDef<Product>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    },
    // ... other columns
  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  });

  // Get selected rows
  const selectedRows = table.getSelectedRowModel().rows;

  return (
    <div>
      {selectedRows.length > 0 && (
        <div className="mb-4">
          {selectedRows.length} row(s) selected
          <button onClick={() => setRowSelection({})}>
            Clear Selection
          </button>
        </div>
      )}

      <table>
        {/* Render table */}
      </table>
    </div>
  );
}
```

### Conditional Row Selection

```tsx
const table = useReactTable({
  data,
  columns,
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  getCoreRowModel: getCoreRowModel(),
  enableRowSelection: (row) => {
    // Only allow selection if product is active
    return row.original.isActive;
  },
});
```

### Bulk Actions

```tsx
function TableWithBulkActions({ data }: { data: Product[] }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  });

  const selectedProducts = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);

  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedProducts.length} products?`)) {
      await Promise.all(
        selectedProducts.map((product) => deleteProduct(product.id))
      );
      setRowSelection({});
    }
  };

  return (
    <div>
      {selectedProducts.length > 0 && (
        <div className="mb-4 flex gap-2">
          <span>{selectedProducts.length} selected</span>
          <button onClick={handleBulkDelete}>Delete Selected</button>
          <button onClick={() => setRowSelection({})}>Cancel</button>
        </div>
      )}

      <table>
        {/* Render table */}
      </table>
    </div>
  );
}
```

---

## 🎨 Styling

### Styled Table Component

```tsx
import { cn } from '@/lib/utils';

function StyledTable({ data }: { data: Product[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b bg-muted/50 transition-colors hover:bg-muted"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
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
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-b transition-colors hover:bg-muted/50',
                row.getIsSelected() && 'bg-muted'
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-4 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Loading State

```tsx
function TableWithLoading({ data, isLoading }: { data: Product[]; isLoading: boolean }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <div className="flex items-center justify-center p-8">
          <Spinner />
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <table>
      {/* Render table */}
    </table>
  );
}
```

### Empty State

```tsx
if (table.getRowModel().rows.length === 0) {
  return (
    <div className="rounded-md border">
      <div className="flex flex-col items-center justify-center p-8">
        <EmptyIcon className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No products found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting your search or filters
        </p>
      </div>
    </div>
  );
}
```

---

## ⚡ Performance

### Virtualization

For large datasets, use virtualization:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedTable({ data }: { data: Product[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated row height
  });

  return (
    <div ref={parentRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];

          return (
            <div
              key={row.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Memoization

Memoize expensive operations:

```tsx
import { useMemo } from 'react';

function OptimizedTable({ data }: { data: Product[] }) {
  // Memoize columns
  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'price', header: 'Price' },
    ],
    []
  );

  // Memoize data
  const memoizedData = useMemo(() => data, [data]);

  const table = useReactTable({
    data: memoizedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return <table>{/* Render table */}</table>;
}
```

---

## 💡 Best Practices

### Do's

**✅ Memoize columns and data**

```tsx
// ✅ Good - prevents unnecessary re-renders
const columns = useMemo(() => [...], []);
const data = useMemo(() => [...], [dependency]);
```

**✅ Use server-side features for large datasets**

```tsx
// ✅ Good - better performance
const table = useReactTable({
  data,
  columns,
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
});
```

**✅ Provide loading and empty states**

```tsx
// ✅ Good - better UX
if (isLoading) return <Spinner />;
if (data.length === 0) return <EmptyState />;
```

**✅ Use type-safe column definitions**

```tsx
// ✅ Good - type safety
const columns: ColumnDef<Product>[] = [
  { accessorKey: 'name', header: 'Name' },
];
```

### Don'ts

**❌ Don't define columns inside component**

```tsx
// ❌ Bad - creates new columns on every render
function MyTable() {
  const columns = [{ accessorKey: 'name' }];
```

**❌ Don't forget row keys**

```tsx
// ❌ Bad - will cause issues
{rows.map((row) => <tr>{/* ... */}</tr>)}

// ✅ Good - always use keys
{rows.map((row) => <tr key={row.id}>{/* ... */}</tr>)}
```

**❌ Don't use client-side features for large datasets**

```tsx
// ❌ Bad - performance issues with 10,000+ rows
const table = useReactTable({
  data: largeDataset,
  getPaginationRowModel: getPaginationRowModel(),
});
```

---

## 🐛 Troubleshooting

### Issue: "Table not rendering"

**Solution:** Verify you're using flexRender:

```tsx
// ❌ Wrong
{header.column.columnDef.header}

// ✅ Correct
{flexRender(header.column.columnDef.header, header.getContext())}
```

### Issue: "Sorting not working"

**Solution:** Check you've added getSortedRowModel:

```tsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(), // ← Don't forget
});
```

### Issue: "Type errors with columns"

**Solution:** Add proper type annotations:

```tsx
// ✅ Correct
const columns: ColumnDef<Product>[] = [
  // Columns are now type-safe
];
```

---

## 📖 Additional Resources

### Official Documentation

- **[TanStack Table Docs](https://tanstack.com/table)** - Complete documentation
- **[Table Guide](https://tanstack.com/table/latest/docs/framework/react/guide/introduction)** - Introduction
- **[Examples](https://tanstack.com/table/latest/docs/framework/react/examples/basic)** - Working examples

### Internal Resources

- **[Creating Pages Tutorial](./creating-pages.md)** - Full page creation
- **[Queries Guide](./queries.md)** - Data fetching patterns
- **[Architecture Overview](../architecture.md)** - Admin architecture

### Examples

- `apps/admin/src/features/*/components/*Table.tsx` - Table components
- `apps/admin/src/routes/*/index.tsx` - List pages with tables

---

⬅️ Back to [Development Documentation](./README.md)
