---
name: tanstack-table-patterns
description: TanStack Table patterns for headless, type-safe tables. Use when building sortable, filterable, paginated tables with column definitions.
---

# TanStack Table Patterns

## Purpose

Provide patterns for building headless, type-safe tables with TanStack Table, including column definitions, sorting, filtering, pagination, row selection, server-side data, and integration with UI libraries.

## Basic Table Setup

```typescript
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const columns: ColumnDef<User>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role" },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
  },
];

function UsersTable({ data }: { data: User[] }) {
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
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
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

## Column Definitions

### Advanced Columns

```typescript
const columns: ColumnDef<User>[] = [
  // Accessor column with custom cell
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar src={row.original.avatar} />
        <span className="font-medium">{row.getValue("name")}</span>
      </div>
    ),
  },

  // Computed column
  {
    id: "fullName",
    header: "Full Name",
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
  },

  // Actions column
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => editUser(row.original.id)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => deleteUser(row.original.id)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    enableSorting: false,
    enableHiding: false,
  },
];
```

## Sorting

```typescript
import { getSortedRowModel, type SortingState } from "@tanstack/react-table";

function SortableTable({ data }: { data: User[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className="cursor-pointer select-none"
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {{ asc: " ^", desc: " v" }[header.column.getIsSorted() as string] ?? null}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      {/* ... body */}
    </table>
  );
}
```

## Filtering

### Global Filter

```typescript
import { getFilteredRowModel, type ColumnFiltersState } from "@tanstack/react-table";

function FilterableTable({ data }: { data: User[] }) {
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Search all columns..."
      />
      {/* ... table rendering */}
    </div>
  );
}
```

### Column Filter

```typescript
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

const table = useReactTable({
  data,
  columns,
  state: { columnFilters },
  onColumnFiltersChange: setColumnFilters,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});

// Filter a specific column
<select
  value={(table.getColumn("role")?.getFilterValue() as string) ?? ""}
  onChange={(e) => table.getColumn("role")?.setFilterValue(e.target.value || undefined)}
>
  <option value="">All Roles</option>
  <option value="admin">Admin</option>
  <option value="user">User</option>
</select>
```

## Pagination

### Client-Side Pagination

```typescript
import { getPaginationRowModel, type PaginationState } from "@tanstack/react-table";

function PaginatedTable({ data }: { data: User[] }) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      {/* ... table rendering */}
      <div className="flex items-center gap-2">
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </button>
      </div>
    </div>
  );
}
```

### Server-Side Pagination

```typescript
function ServerTable() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const { data, isLoading } = useQuery({
    queryKey: ["users", pagination],
    queryFn: () =>
      fetchUsers({ page: pagination.pageIndex + 1, pageSize: pagination.pageSize }),
  });

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    rowCount: data?.totalCount ?? 0,
    state: { pagination },
    onPaginationChange: setPagination,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {/* ... table rendering */}
      <div>
        Page {pagination.pageIndex + 1} of {table.getPageCount()}
      </div>
    </div>
  );
}
```

## Row Selection

```typescript
import { type RowSelectionState } from "@tanstack/react-table";

const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

const selectionColumn: ColumnDef<User> = {
  id: "select",
  header: ({ table }) => (
    <input
      type="checkbox"
      checked={table.getIsAllPageRowsSelected()}
      onChange={table.getToggleAllPageRowsSelectedHandler()}
    />
  ),
  cell: ({ row }) => (
    <input
      type="checkbox"
      checked={row.getIsSelected()}
      onChange={row.getToggleSelectedHandler()}
    />
  ),
  enableSorting: false,
};

const table = useReactTable({
  data,
  columns: [selectionColumn, ...columns],
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  getCoreRowModel: getCoreRowModel(),
  enableRowSelection: true,
});

// Get selected rows
const selectedRows = table.getFilteredSelectedRowModel().rows;
```

## Best Practices

- Define column definitions outside the component or memoize them to avoid re-creation on every render
- Use `accessorFn` for computed columns derived from multiple fields
- Use `manualPagination`, `manualSorting`, and `manualFiltering` for server-driven data
- Provide `rowCount` when using manual pagination for correct page count calculation
- Use `enableSorting: false` on action columns that should not be sortable
- Use `flexRender` for all header and cell rendering to support both strings and components
- Combine TanStack Table with TanStack Query for server-side operations with caching
- Use `getFilteredSelectedRowModel()` to access only currently filtered selected rows
- Add `sr-only` class to action column headers for accessibility
- Keep table state (sorting, pagination, filters) in URL search params for shareable views
