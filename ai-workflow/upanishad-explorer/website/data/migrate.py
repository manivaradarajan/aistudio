import os
import json

# This dictionary holds the mapping from the old string values
# to their new Devanagari labels. This is the data we removed from constants.js.
DEVANAGARI_LABELS = {
    "Anuvaka": "अनुवाकः",
    "Mantra": "मन्त्रः",
    "Khanda": "खण्डः",
    "Valli": "वल्ली",
    "Mundaka": "मुण्डकः",
    "Adhyaya": "अध्यायः",
    "Brahmana": "ब्राह्मणम्",
}

def update_json_files():
    """
    Scans the current directory for .json files and updates the
    'structure_levels' field from a simple list of strings to a
    list of objects with script names.
    """
    print("Scanning for JSON files to migrate...")

    # List all files in the current directory where the script is run
    for filename in os.listdir('.'):
        if filename.endswith('.json'):
            print(f"\nProcessing '{filename}'...")

            try:
                # Open the file for reading with UTF-8 encoding
                with open(filename, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Check if 'structure_levels' key exists
                if 'structure_levels' not in data:
                    print("  - No 'structure_levels' key found. Skipping.")
                    continue

                levels = data['structure_levels']

                # Check if migration is needed (i.e., if the first item is a string)
                if not levels or not isinstance(levels[0], str):
                    print("  - 'structure_levels' is already in the new format. Skipping.")
                    continue

                # --- Perform the migration ---
                print("  - Old format found. Migrating 'structure_levels'...")
                new_levels = []
                for level_key in levels:
                    # Look up the Devanagari label, fallback to the key itself if not found
                    devanagari_label = DEVANAGARI_LABELS.get(level_key, level_key)

                    new_level_obj = {
                        "key": level_key,
                        "scriptNames": {
                            "devanagari": devanagari_label
                        }
                    }
                    new_levels.append(new_level_obj)

                # Replace the old list with the new one
                data['structure_levels'] = new_levels

                # --- Write the changes back to the file ---
                # Use UTF-8 encoding and ensure_ascii=False to preserve Devanagari
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                print(f"  - Successfully updated '{filename}'.")

            except json.JSONDecodeError:
                print(f"  - ERROR: Could not parse '{filename}'. It might be an invalid JSON file.")
            except Exception as e:
                print(f"  - ERROR: An unexpected error occurred with '{filename}': {e}")

    print("\nMigration complete.")

if __name__ == "__main__":
    # It's always a good idea to recommend a backup before running a modifying script.
    print("="*50)
    print("IMPORTANT: This script will modify JSON files in place.")
    print("It is highly recommended to back up your 'data/' directory before proceeding.")
    print("="*50)

    # Ask for user confirmation
    proceed = input("Do you want to continue? (y/n): ")
    if proceed.lower() == 'y':
        update_json_files()
    else:
        print("Operation cancelled.")