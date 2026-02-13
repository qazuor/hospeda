import { FileIcon, ImageIcon, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const ALLOWED_EXTENSIONS = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'text/plain',
    'text/x-log'
];

const ACCEPT_STRING = 'image/*,video/mp4,video/webm,.pdf,.txt,.log';

interface FileUploadZoneProps {
    files: File[];
    onFilesChange: (files: File[]) => void;
    error?: string;
}

/**
 * Formats file size in human-readable format
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks if a file type is an image
 */
function isImageFile(type: string): boolean {
    return type.startsWith('image/');
}

/**
 * Drag-and-drop file upload zone with previews.
 * Validates file type, size, and count on the client side.
 */
export function FileUploadZone({ files, onFilesChange, error }: FileUploadZoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateAndAddFiles = useCallback(
        (newFiles: FileList | File[]) => {
            setLocalError(null);
            const fileArray = Array.from(newFiles);
            const validFiles: File[] = [];

            for (const file of fileArray) {
                if (files.length + validFiles.length >= MAX_FILES) {
                    setLocalError(`Maximo ${MAX_FILES} archivos permitidos`);
                    break;
                }

                if (file.size > MAX_FILE_SIZE) {
                    setLocalError(`"${file.name}" excede el limite de 10MB`);
                    continue;
                }

                if (!ALLOWED_EXTENSIONS.includes(file.type)) {
                    setLocalError(
                        `Tipo de archivo "${file.type}" no permitido para "${file.name}"`
                    );
                    continue;
                }

                validFiles.push(file);
            }

            if (validFiles.length > 0) {
                onFilesChange([...files, ...validFiles]);
            }
        },
        [files, onFilesChange]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files.length > 0) {
                validateAndAddFiles(e.dataTransfer.files);
            }
        },
        [validateAndAddFiles]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                validateAndAddFiles(e.target.files);
            }
            // Reset input so the same file can be selected again
            e.target.value = '';
        },
        [validateAndAddFiles]
    );

    const removeFile = useCallback(
        (index: number) => {
            const updated = files.filter((_, i) => i !== index);
            onFilesChange(updated);
            setLocalError(null);
        },
        [files, onFilesChange]
    );

    const displayError = error ?? localError;

    return (
        <div className="space-y-3">
            {/* Drop zone */}
            <button
                type="button"
                className={`relative w-full cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-200 ${isDragOver ? 'border-ring bg-accent/50' : 'border-input hover:border-ring/50 hover:bg-accent/20'}
                    ${displayError ? 'border-destructive' : ''}
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleClick}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPT_STRING}
                    className="hidden"
                    onChange={handleInputChange}
                />

                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                    <span className="font-medium text-foreground">
                        Hacer click para seleccionar
                    </span>{' '}
                    o arrastrar archivos aqui
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                    PNG, JPG, GIF, WebP, MP4, WebM, PDF, TXT, LOG. Max 10MB por archivo.
                </p>
                <p className="text-muted-foreground text-xs">
                    {files.length}/{MAX_FILES} archivos
                </p>
            </button>

            {/* Error message */}
            {displayError && <p className="text-destructive text-sm">{displayError}</p>}

            {/* File list */}
            {files.length > 0 && (
                <ul className="space-y-2">
                    {files.map((file, index) => (
                        <li
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center gap-3 rounded-md border border-input bg-background p-2"
                        >
                            {/* Icon or thumbnail */}
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                                {isImageFile(file.type) ? (
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt={file.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : file.type.startsWith('video/') ? (
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                                )}
                            </div>

                            {/* File info */}
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-sm">{file.name}</p>
                                <p className="text-muted-foreground text-xs">
                                    {formatFileSize(file.size)}
                                </p>
                            </div>

                            {/* Remove button */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(index);
                                }}
                                className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Eliminar ${file.name}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
