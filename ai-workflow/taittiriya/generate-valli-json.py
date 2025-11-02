import json
import re
from pathlib import Path

def parse_valli(file_path, valli_name, valli_number):
    """
    Parses a markdown file containing a Valli of the Taittiriya Upanishad.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    valli_data = {
        "valli_name": valli_name,
        "valli_number": valli_number,
        "anuvakas": []
    }

    # Find all Anuvaka sections
    anuvaka_headings = [
        "प्रथमोऽनुवाकः", "द्वितीयोऽनुवाकः", "तृतीयोऽनुवाकः",
        "चतुर्थोऽनुवाकः", "पञ्चमोऽनुवाकः", "षष्ठोऽनुवाकः",
        "सप्तमोऽनुवाकः", "अष्टमोऽनुवाकः", "नवमोऽनुवाकः",
        "दशमोऽनुवाकः", "एकादशोऽनुवाकः", "द्वादशोऽनुवाकः"
    ]
    
    # Split the content by Anuvaka headings
    # We use a positive lookahead to keep the delimiters
    pattern = '|'.join([f'(?={h})' for h in anuvaka_headings])
    parts = re.split(pattern, content)
    
    preamble = ""
    start_index = 0

    # The first part before any Anuvaka heading is a preamble
    if not parts[0].strip().startswith(tuple(anuvaka_headings)):
        preamble = parts[0].strip()
        start_index = 1
    
    anuvaka_number = 1
    for i in range(start_index, len(parts)):
        part = parts[i].strip()
        
        # Skip empty parts
        if not part:
            continue

        # Find the end of the Anuvaka
        anuvaka_end_marker = f"इति {anuvaka_headings[anuvaka_number-1]}"
        if "इति दशमोनुवाकः" in part: # Special case for Bhriguvalli 10
            anuvaka_end_marker = "इति दशमोनुवाकः"
            
        anuvaka_content = part.split(anuvaka_end_marker)[0]
        
        # Split into mantra and commentary
        # Mantra is typically bolded and comes first
        
        # Remove the Anuvaka heading and any section title in brackets
        processed_content = re.sub(r'^\s*' + anuvaka_headings[anuvaka_number-1] + r'\s*', '', anuvaka_content, 1).strip()
        processed_content = re.sub(r'^\s*\[.*?\]\s*', '', processed_content).strip()

        mantra_text = ""
        commentary_text = ""

        # Specific logic for splitting mantra and commentary
        if valli_name == "शिक्षावल्ली":
            # The split point is typically 'प्रकाशिका' or a specific phrase.
            if "प्रकाशिका" in processed_content:
                split_point = processed_content.find("प्रकाशिका")
                mantra_text = processed_content[:split_point].strip()
                commentary_text = processed_content[split_point:].strip()
            elif "शीक्षां व्याख्यास्यामः इति" in processed_content:
                mantra_text = processed_content.split("शीक्षां व्याख्यास्यामः इति")[0].strip()
                commentary_text = "शीक्षां व्याख्यास्यामः इति" + processed_content.split("शीक्षां व्याख्यास्यामः इति")[1]
            elif "विद्याफलं गुरुशिष्योभयगतमस्त्विति" in processed_content:
                 mantra_text = processed_content.split("विद्याफलं गुरुशिष्योभयगतमस्त्विति")[0].strip()
                 commentary_text = "विद्याफलं गुरुशिष्योभयगतमस्त्विति" + processed_content.split("विद्याफलं गुरुशिष्योभयगतमस्त्विति")[1]
            else:
                 # Default split by first paragraph for other cases
                 lines = processed_content.split('\n')
                 mantra_lines = []
                 commentary_started = False
                 commentary_lines = []
                 for line in lines:
                     if line.strip() and not commentary_started:
                         if any(kw in line for kw in ["इति", "प्रार्थयते", "आह", "उपदिश्यते", "प्रशंसति"]):
                              commentary_started = True
                              commentary_lines.append(line)
                         else:
                              mantra_lines.append(line)
                     else:
                         commentary_lines.append(line)
                 mantra_text = "\n".join(mantra_lines).strip()
                 commentary_text = "\n".join(commentary_lines).strip()
        
        elif valli_name == "आनन्दवल्ली":
            # Split point is generally the first sentence of commentary
            split_patterns = [
                "परमतत्त्वहितपुरुषार्थप्रतिपादिका", "अन्नाद्वा इति", "प्राणम् इति", "यतो वाचो इति",
                "विज्ञानम् इति", "असन्नेव इति", "तस्माद्वा इत्यादि", "भीषाऽस्मात् इति", "यतो वाचः इति"
            ]
            found_split = False
            for pat in split_patterns:
                if pat in processed_content:
                    mantra_text = processed_content.split(pat)[0].strip()
                    commentary_text = pat + processed_content.split(pat)[1]
                    found_split = True
                    break
            if not found_split: # Fallback
                mantra_text = processed_content
        
        elif valli_name == "भृगुवल्ली":
             split_patterns = [
                "अथ लक्षणान्तरमुखेन", "प्रथमतः अन्नस्य", "स्पष्टोऽर्थः", "सैषा भार्गवी इति",
                "एतद्विद्याङ्गं व्रतमाह", "न परिचक्षीत", "बहु कुर्वीति इति", "न कञ्चन वसतौ"
            ]
            found_split = False
            for pat in split_patterns:
                if pat in processed_content:
                    mantra_text = processed_content.split(pat)[0].strip()
                    commentary_text = pat + processed_content.split(pat)[1]
                    found_split = True
                    break
            if not found_split: # Fallback for anu 3,4,5
                 if "स्पष्टोऽर्थः" in processed_content:
                      mantra_text = processed_content.split("स्पष्टोऽर्थः")[0].strip()
                      commentary_text = "स्पष्टोऽर्थः" + processed_content.split("स्पष्टोऽर्थः")[1] if len(processed_content.split("स्पष्टोऽर्थः")) > 1 else "स्पष्टोऽर्थः"
                 else:
                     mantra_text = processed_content
                     
        # Clean up text by removing extra asterisks from formatting
        mantra_text = mantra_text.replace('**', '').replace('।।', ' ।। ').replace('।', ' । ').strip()
        commentary_text = commentary_text.replace('**', '').replace('।।', ' ।। ').replace('।', ' । ').strip()
        
        # Prepend preamble to the first Anuvaka's commentary
        if anuvaka_number == 1 and preamble:
            # For Anandavalli and Bhriguvalli, the preamble is a separate mantra+bhashya
            if "सह नाववतु" in preamble or "हरिः ओम्" in preamble:
                # The preamble itself is a full unit, so we prepend it.
                commentary_text = preamble.replace('**','').strip() + "\n\n" + commentary_text

        valli_data["anuvakas"].append({
            "anuvaka_number": anuvaka_number,
            "mantra_text": mantra_text,
            "commentary_text": commentary_text
        })
        
        anuvaka_number += 1
        
    return valli_data

def main():
    """
    Main function to parse all Vallis and generate the final JSON.
    """
    import argparse

    parser = argparse.ArgumentParser(description="Parse Taittiriya Upanishad markdown files and generate a structured JSON output.")
    parser.add_argument("input_files", nargs='+', help="List of input markdown files for the Vallis.")
    parser.add_argument("-o", "--output", default="taittiriya_upanishad_structured.json", help="Output JSON file name.")
    args = parser.parse_args()

    all_upanishad_data = []
    valli_info = {
        "taittirIyopaniSat-zikSA.md": ("शिक्षावल्ली", 1),
        "taittirIyopaniSat-Anandava.md": ("आनन्दवल्ली", 2),
        "taittirIyopaniSat-bhRguvala.md": ("भृगुवल्ली", 3)
    }

    for file_path in args.input_files:
        file_name = Path(file_path).name
        if file_name in valli_info:
            valli_name, valli_number = valli_info[file_name]
            try:
                valli_data = parse_valli(file_path, valli_name, valli_number)
                all_upanishad_data.append(valli_data)
            except FileNotFoundError:
                print(f"Error: File not found at {file_path}")
                return
        else:
            print(f"Warning: No Valli information found for file: {file_name}")

    # Write the structured data to a JSON file
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(all_upanishad_data, f, ensure_ascii=False, indent=2)

    print(f"Successfully parsed the Taittiriya Upanishad and created {args.output}")

if __name__ == '__main__':
    main()
    
