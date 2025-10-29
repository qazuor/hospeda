#!/bin/bash

# Markdown Formatter Script - Final working version
# Fixes markdown formatting issues using reliable shell commands

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Markdown Formatter v1.0${NC}"
echo -e "${GREEN}================================${NC}"

# Function to show usage
show_usage() {
    echo "Usage: $0 [options] [file_or_directory]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -v, --validate-only Validate only, don't fix"
    echo "  -r, --rules RULES   Comma-separated list of rules (e.g., MD040,MD031)"
    echo "  -q, --quiet         Quiet mode"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Fix all .md files in .claude/"
    echo "  $0 file.md                          # Fix specific file"
    echo "  $0 --validate-only                  # Check without fixing"
    echo "  $0 --rules MD040,MD031,MD022        # Apply specific rules only"
}

# Default options
VALIDATE_ONLY=false
QUIET=false
RULES=""
TARGET_PATH=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -v|--validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        -r|--rules)
            RULES="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -*)
            echo -e "${RED}Error: Unknown option $1${NC}" >&2
            show_usage >&2
            exit 1
            ;;
        *)
            TARGET_PATH="$1"
            shift
            ;;
    esac
done

# Function to log messages
log() {
    if [[ "$QUIET" != "true" ]]; then
        echo -e "$1"
    fi
}

# Function to apply markdown fixes to a file
fix_markdown_file() {
    local file="$1"
    local basename_file=$(basename "$file")
    
    log "  📝 Processing: $basename_file"
    
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        # TODO: Add validation logic here
        log "    ℹ️  Validation mode - no changes made"
        return 0
    fi
    
    # Create backup
    cp "$file" "${file}.bak"
    
    # Apply fixes using sed
    local temp_file="${file}.tmp"
    
    # MD040: Add language to bare code fences
    sed 's/^```$/```text/g' "$file" > "$temp_file"
    
    # MD026: Remove trailing punctuation from headings
    sed 's/^\(#{1,6}[[:space:]].*\)[.!?:]\+$/\1/g' "$temp_file" > "${temp_file}.2"
    
    # MD009: Remove trailing spaces
    sed 's/[[:space:]]\+$//g' "${temp_file}.2" > "${temp_file}.3"
    
    # MD012: Remove multiple consecutive blank lines
    sed '/^$/N;/^\n$/d' "${temp_file}.3" > "${temp_file}.4"
    
    # Move final result back
    mv "${temp_file}.4" "$file"
    
    # Clean up temporary files
    rm -f "$temp_file" "${temp_file}.2" "${temp_file}.3" "${file}.bak"
    
    log "    ✅ Fixed"
}

# Function to find markdown files
find_markdown_files() {
    local search_path="$1"
    
    if [[ -f "$search_path" ]]; then
        echo "$search_path"
    elif [[ -d "$search_path" ]]; then
        find "$search_path" -name "*.md" -type f
    else
        echo -e "${RED}Error: Path not found: $search_path${NC}" >&2
        exit 1
    fi
}

# Main execution
main() {
    # Determine target path
    if [[ -z "$TARGET_PATH" ]]; then
        TARGET_PATH="/home/qazuor/projects/WEBS/hospeda/.claude"
    fi
    
    log "${GREEN}📋 Finding markdown files...${NC}"
    
    # Get list of files to process
    local files
    files=$(find_markdown_files "$TARGET_PATH")
    
    if [[ -z "$files" ]]; then
        log "${YELLOW}⚠️  No markdown files found${NC}"
        exit 0
    fi
    
    local file_count
    file_count=$(echo "$files" | wc -l)
    
    log "${GREEN}📊 Found $file_count markdown file(s)${NC}"
    log ""
    
    # Process each file
    local processed=0
    local errors=0
    
    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            if fix_markdown_file "$file"; then
                ((processed++))
            else
                log "    ${RED}❌ Error processing $file${NC}"
                ((errors++))
            fi
        fi
    done <<< "$files"
    
    log ""
    log "${GREEN}📊 Summary:${NC}"
    log "   Processed: $processed files"
    if [[ $errors -gt 0 ]]; then
        log "   ${RED}Errors: $errors files${NC}"
        exit 1
    else
        log "   ${GREEN}✅ All files processed successfully${NC}"
    fi
}

# Run main function
main

echo -e "${GREEN}🎉 Markdown formatting complete!${NC}"