import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { fetchApi } from '@/lib/api/client';
import { useEffect, useRef, useState } from 'react';

/** Accommodation item returned by the admin search endpoint. */
interface AccommodationItem {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
}

/**
 * Searchable combobox for selecting an accommodation.
 *
 * Fetches results from `GET /api/v1/admin/accommodations?search=<q>` with
 * debounced input (300ms). Displays name + slug in the dropdown and stores
 * the selected accommodation ID.
 */
export function AccommodationCombobox(props: {
    readonly value: string;
    readonly onChange: (id: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<AccommodationItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedName, setSelectedName] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch accommodations when debounced search changes or dropdown opens
    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();
        setIsLoading(true);

        const query = debouncedSearch.trim()
            ? `?search=${encodeURIComponent(debouncedSearch)}&pageSize=20`
            : '?pageSize=20';

        fetchApi<{
            success: boolean;
            data: { items: AccommodationItem[]; pagination: unknown };
        }>({
            path: `/api/v1/admin/accommodations${query}`,
            signal: controller.signal
        })
            .then((res) => {
                setResults(res.data.data.items);
            })
            .catch(() => {
                // Aborted or network error — silent
            })
            .finally(() => {
                setIsLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [debouncedSearch, isOpen]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = (item: AccommodationItem) => {
        props.onChange(item.id);
        setSelectedName(`${item.name} (${item.slug})`);
        setSearch('');
        setIsOpen(false);
        setResults([]);
    };

    const handleClear = () => {
        props.onChange('');
        setSelectedName('');
        setSearch('');
        setResults([]);
    };

    return (
        <div
            ref={containerRef}
            className="relative"
        >
            <Label>Alojamiento</Label>
            {props.value && selectedName ? (
                <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        {selectedName}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="shrink-0"
                    >
                        ×
                    </Button>
                </div>
            ) : (
                <Input
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Buscar alojamiento por nombre..."
                    className="mt-2"
                />
            )}
            {isOpen && results.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-[200px] w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                    {isLoading && (
                        <div className="px-3 py-2 text-muted-foreground text-sm">Buscando...</div>
                    )}
                    {!isLoading &&
                        results.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
                                onClick={() => handleSelect(item)}
                            >
                                <span className="font-medium">{item.name}</span>
                                <span className="text-muted-foreground text-xs">{item.slug}</span>
                            </button>
                        ))}
                </div>
            )}
        </div>
    );
}
