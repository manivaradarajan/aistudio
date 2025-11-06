import os
import json
import re
from collections import defaultdict

# --- Configuration ---
INTERNAL_LIB_FILE = 'library-internal.json'
EXTERNAL_LIB_FILE = 'library-external.json'
DATA_DIR = 'data/'
# ---------------------

# --- ENHANCED REGEX PATTERNS ---
# These patterns are robust and designed to handle all various formats found in the data,
# including Markdown links, wrapped links, and raw paths.

# Pattern 1: Matches "([Text](/reference/slug/path))" - Most specific
PATTERN_WRAPPED = re.compile(r'\(\[([^\]]+)\]\(\/reference\/([^\s()]+)\)\)')

# Pattern 2: Matches "[Text](/reference/slug/path)" - Standard Markdown link
PATTERN_STANDARD = re.compile(r'\[([^\]]+)\]\(\/reference\/([^\s()]+)\)')

# Pattern 3: Matches any (/reference/slug/path) pattern (bare, in parens)
PATTERN_PAREN = re.compile(r'\(\/reference\/([^\s()]+)\)')

# Pattern 4: Matches raw "/reference/slug/path" not already part of a markdown link.
# The `(?<!\]\()` is a negative lookbehind that ensures we don't re-match a path
# that is inside a standard [...]() link, making this safe to run after other patterns.
PATTERN_RAW = re.compile(r'(?<!\]\()\/reference\/([^\s()]+)')

# List of all patterns for a comprehensive analysis
ALL_PATTERNS = [PATTERN_WRAPPED, PATTERN_STANDARD, PATTERN_PAREN, PATTERN_RAW]


def load_library():
    """Loads and combines both library files."""
    if not (os.path.exists(INTERNAL_LIB_FILE) and os.path.exists(EXTERNAL_LIB_FILE)):
        print(f"ERROR: Source files '{INTERNAL_LIB_FILE}' and/or '{EXTERNAL_LIB_FILE}' not found.")
        return None
    with open(INTERNAL_LIB_FILE, 'r', encoding='utf-8') as f:
        internal_data = json.load(f)
    with open(EXTERNAL_LIB_FILE, 'r', encoding='utf-8') as f:
        external_data = json.load(f)
    return internal_data + external_data

def build_alias_map(library_data):
    """Builds a dictionary mapping every possible alias to its canonical slug."""
    alias_map = {}
    if not library_data: return alias_map
    for entry in library_data:
        canonical_slug = entry.get('slug')
        if not canonical_slug: continue
        alias_map[canonical_slug] = canonical_slug
        for alias in entry.get('aliases', []):
            alias_map[alias] = canonical_slug
    return alias_map

def find_commentary_texts(data):
    """A generator that yields all 'commentary_text' strings from the data structure."""
    if isinstance(data, dict):
        if 'commentary_text' in data and data['commentary_text']: yield data['commentary_text']
        if 'children' in data: yield from find_commentary_texts(data.get('children', []))
    elif isinstance(data, list):
        for item in data: yield from find_commentary_texts(item)

def extract_slug_from_path(full_path):
    """Extracts the slug from a full reference path."""
    return full_path.split('/')[0]

def analyze_references():
    """Phase 1: Scans all data files and reports unrecognized slugs using all patterns."""
    print("\n--- Analyzing references for unrecognized slugs ---")
    library_data = load_library()
    if library_data is None: return {}

    alias_map = build_alias_map(library_data)
    unrecognized_slugs = defaultdict(set)
    all_found_paths = defaultdict(set)

    print(f"Scanning files in '{DATA_DIR}'...")
    for filename in sorted(os.listdir(DATA_DIR)):
        if not filename.endswith('.json'): continue
        filepath = os.path.join(DATA_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f: data = json.load(f)

        for commentary in find_commentary_texts(data.get('content', [])):
            # Handle patterns with display text (2 capture groups)
            for pattern in [PATTERN_WRAPPED, PATTERN_STANDARD]:
                for match in pattern.finditer(commentary):
                    _display_text, full_path = match.groups()
                    slug = extract_slug_from_path(full_path)
                    all_found_paths[slug].add(full_path)
                    if slug not in alias_map:
                        unrecognized_slugs[slug].add(filename)

            # Handle patterns without display text (1 capture group)
            for pattern in [PATTERN_PAREN, PATTERN_RAW]:
                for match in pattern.finditer(commentary):
                    full_path = match.group(1)
                    slug = extract_slug_from_path(full_path)
                    all_found_paths[slug].add(full_path)
                    if slug not in alias_map:
                        unrecognized_slugs[slug].add(filename)

    if not unrecognized_slugs:
        print("\nSUCCESS: All '/reference/...' slugs are recognized in the library files.")
        print(f"Total unique slugs found: {len(all_found_paths)}")
    else:
        print("\nWARNING: Found unrecognized slugs.")
        print("-" * 60)
        for slug, files in sorted(unrecognized_slugs.items()):
            example_paths = sorted(list(all_found_paths[slug]))[:3]
            example_str = ', '.join(example_paths)
            if len(all_found_paths[slug]) > 3:
                example_str += f" ... ({len(all_found_paths[slug])} total paths)"
            print(f"  - Slug: '{slug}'")
            print(f"    Files: {', '.join(sorted(list(files)))}")
            print(f"    Example paths: {example_str}")
        print("-" * 60)

    return unrecognized_slugs

def slug_to_name(slug):
    """Converts a slug like 'purva-mimamsa' to a title-cased name 'Purva Mimamsa'."""
    return ' '.join(word.capitalize() for word in slug.split('-'))

def add_slugs_to_library(unrecognized_slugs):
    """Phase 2: Adds new entries for unrecognized slugs to library-external.json."""
    print(f"\n--- Adding {len(unrecognized_slugs)} new entries to {EXTERNAL_LIB_FILE} ---")

    if not os.path.exists(EXTERNAL_LIB_FILE):
        print(f"ERROR: '{EXTERNAL_LIB_FILE}' not found. Cannot add new entries.")
        return

    with open(EXTERNAL_LIB_FILE, 'r', encoding='utf-8') as f:
        external_data = json.load(f)

    existing_slugs = {entry['slug'] for entry in external_data if 'slug' in entry}
    new_entries_added = 0

    for slug in sorted(unrecognized_slugs.keys()):
        if slug in existing_slugs:
            print(f"  - Skipping '{slug}', already exists in library.")
            continue

        placeholder_name = slug_to_name(slug)
        new_entry = {
            "slug": slug, "name": placeholder_name,
            "scriptNames": { "devanagari": placeholder_name, "iast": placeholder_name },
            "aliases": [slug], "type": "unknown", "isInternal": False
        }
        external_data.append(new_entry)
        print(f"  - Added new entry for slug: '{slug}'")
        new_entries_added += 1

    if new_entries_added > 0:
        external_data.sort(key=lambda x: x.get('slug', ''))
        with open(EXTERNAL_LIB_FILE, 'w', encoding='utf-8') as f:
            json.dump(external_data, f, ensure_ascii=False, indent=2)
        print(f"\nSUCCESS: Added {new_entries_added} new entries to '{EXTERNAL_LIB_FILE}'.")
        print("Please review the file to update placeholder names and types.")
    else:
        print("\nNo new entries were added.")

def migrate_references():
    """Phase 3: Converts all '/reference/' links to 'ref:' using all patterns."""
    print(f"\n--- Migrating references in {DATA_DIR} files ---")
    library_data = load_library()
    if library_data is None: return
    alias_map = build_alias_map(library_data)

    def get_ref_parts(full_path, alias_map):
        slug = extract_slug_from_path(full_path)
        path_parts = full_path.split('/', 1)
        path_suffix = '/' + path_parts[1] if len(path_parts) > 1 else ''
        canonical_slug = alias_map.get(slug)
        return canonical_slug, path_suffix, slug, full_path

    # --- REPLACER LOGIC ---

    def create_wrapped_markdown_replacer(alias_map):
        def replacer(match):
            display_text, full_path = match.groups()
            canonical_slug, path_suffix, slug, _ = get_ref_parts(full_path, alias_map)
            if canonical_slug:
                return f'([{display_text}](ref:{canonical_slug}{path_suffix}))'
            else:
                print(f"  - WARNING: Stripping unrecognized link for slug '{slug}' (path: {full_path}).")
                return display_text
        return replacer

    def create_standard_markdown_replacer(alias_map):
        def replacer(match):
            display_text, full_path = match.groups()
            canonical_slug, path_suffix, slug, _ = get_ref_parts(full_path, alias_map)
            if canonical_slug:
                return f'[{display_text}](ref:{canonical_slug}{path_suffix})'
            else:
                print(f"  - WARNING: Stripping unrecognized link for slug '{slug}' (path: {full_path}).")
                return display_text
        return replacer

    def create_paren_replacer(alias_map):
        def replacer(match):
            full_path = match.group(1)
            canonical_slug, path_suffix, slug, _ = get_ref_parts(full_path, alias_map)
            if canonical_slug:
                return f'(ref:{canonical_slug}{path_suffix})'
            else:
                print(f"  - WARNING: Skipping unrecognized parenthesized ref '{slug}' (path: {full_path}).")
                return match.group(0) # Return original on failure
        return replacer

    def create_raw_replacer(alias_map):
        def replacer(match):
            full_path = match.group(1)
            canonical_slug, path_suffix, slug, _ = get_ref_parts(full_path, alias_map)
            if canonical_slug:
                return f'ref:{canonical_slug}{path_suffix}'
            else:
                print(f"  - WARNING: Skipping unrecognized raw ref '{slug}' (path: {full_path}).")
                return match.group(0) # Return original on failure
        return replacer

    total_updated_files = 0
    for filename in sorted(os.listdir(DATA_DIR)):
        if not filename.endswith('.json'): continue
        filepath = os.path.join(DATA_DIR, filename)

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                original_content = f.read()

            mutable_data_str = original_content
            wrapped_replacer = create_wrapped_markdown_replacer(alias_map)
            standard_replacer = create_standard_markdown_replacer(alias_map)
            paren_replacer = create_paren_replacer(alias_map)
            raw_replacer = create_raw_replacer(alias_map)

            # Apply patterns sequentially from most specific to least specific.
            # This order is crucial for correctness. For example, PATTERN_WRAPPED must run
            # before PATTERN_STANDARD to correctly handle the outer parentheses.
            mutable_data_str = PATTERN_WRAPPED.sub(wrapped_replacer, mutable_data_str)
            mutable_data_str = PATTERN_STANDARD.sub(standard_replacer, mutable_data_str)
            mutable_data_str = PATTERN_PAREN.sub(paren_replacer, mutable_data_str)
            mutable_data_str = PATTERN_RAW.sub(raw_replacer, mutable_data_str)

            if original_content != mutable_data_str:
                final_data = json.loads(mutable_data_str)
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(final_data, f, ensure_ascii=False, indent=2)
                print(f"  - Updated '{filepath}'")
                total_updated_files += 1

        except Exception as e:
            print(f"  - ERROR processing '{filepath}': {e}")

    if total_updated_files > 0:
        print(f"\nMigration complete. {total_updated_files} file(s) were modified.")
    else:
        print("\nMigration complete. No files needed modification.")


def main_menu():
    """Presents the main menu to the user."""
    while True:
        print("\n--- Reference Management Script ---")
        print("1. Analyze & Report Unrecognized Slugs (Read-only)")
        print("2. Add Unrecognized Slugs to library-external.json")
        print("3. Migrate All References in data/ Files")
        print("4. Exit")

        choice = input("Enter your choice (1-4): ")

        if choice == '1':
            analyze_references()
        elif choice == '2':
            slugs_to_add = analyze_references()
            if slugs_to_add:
                confirm = input("Do you want to add these slugs to library-external.json? (y/n): ")
                if confirm.lower() == 'y':
                    add_slugs_to_library(slugs_to_add)
            elif not slugs_to_add and os.path.exists(EXTERNAL_LIB_FILE):
                 print("No unrecognized slugs to add.")
        elif choice == '3':
            print("\nWARNING: This will permanently modify files in the 'data/' directory.")
            print("It is highly recommended to run steps 1 and 2 first to avoid data loss.")
            confirm = input("Are you sure you want to proceed with migration? (y/n): ")
            if confirm.lower() == 'y':
                migrate_references()
        elif choice == '4':
            print("Exiting.")
            break
        else:
            print("Invalid choice. Please enter a number between 1 and 4.")

if __name__ == "__main__":
    main_menu()