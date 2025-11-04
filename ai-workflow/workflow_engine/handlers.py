import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple, Set
import json
import jsonref

import google.generativeai as genai
from aksharamukha import transliterate

from .config import Config
from .gemini_utils import _call_gemini_api
from .file_utils import _get_output_path, _gather_files, is_stale, OUTPUT_DIR
from .ui import Spinner

try:
    import jsonschema

    JSONSCHEMA_AVAILABLE = True
except ImportError:
    JSONSCHEMA_AVAILABLE = False
    logging.warning(
        "jsonschema library not available. JSON validation will be skipped. Install with: pip install jsonschema"
    )


def handle_extract_text_step(
    step: Dict, config: Config, prefix: str, input_pdf: Path, context: Dict, force: bool
) -> Path:
    """Handles the 'extract_text_from_pdf' workflow step.

    Args:
        step: The configuration for the 'extract_text_from_pdf' step.
        config: The global configuration object.
        prefix: The prefix for the current run.
        input_pdf: The path to the input PDF file.
        context: The context for the current workflow run.
        force: If True, forces regeneration of all files.

    Returns:
        The path to the output text file.
    """
    logging.info("\n[Workflow Step: extract_text_from_pdf]")
    output_path = _get_output_path(prefix, step)
    prompt_path = Path(step["prompt"])
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file '{prompt_path}' not found.")

    if is_stale(output_path, [input_pdf, prompt_path], force):
        logging.info(
            f"Uploading '{input_pdf.name}' and generating text with '{prompt_path.name}'."
        )
        model_name = step.get("model", config.model)
        model = genai.GenerativeModel(model_name)

        with Spinner("Uploading PDF..."):
            file_handle = genai.upload_file(path=str(input_pdf))
            context["initial_file_handle"] = file_handle
            logging.info("File uploaded successfully. Context handle stored.")

        prompt_parts = [prompt_path.read_text(encoding="utf-8"), file_handle]
        response_text = _call_gemini_api(
            model, prompt_parts, "Extracting text from PDF..."
        )

        output_path.write_text(response_text, encoding="utf-8")
        logging.info(f"--> Saved output to: {output_path}")
    else:
        logging.info(f"Skipping step. Using cached file: {output_path}")
    return output_path


def handle_convert_script_step(
    step: Dict, prefix: str, input_path: Path, force: bool
) -> Path:
    """Handles the 'convert_script' workflow step.

    Args:
        step: The configuration for the 'convert_script' step.
        prefix: The prefix for the current run.
        input_path: The path to the input file for this step.
        force: If True, forces regeneration of all files.

    Returns:
        The path to the output file.
    """
    logging.info("\n[Workflow Step: convert_script]")
    output_path = _get_output_path(prefix, step)

    if is_stale(output_path, [input_path], force):
        logging.info(
            f"Converting '{input_path.name}' from {step['from']} to {step['to']}."
        )
        input_text = input_path.read_text(encoding="utf-8")
        converted_text = transliterate.process(step["from"], step["to"], input_text)
        output_path.write_text(converted_text, encoding="utf-8")
        logging.info(f"--> Saved output to: {output_path}")
    else:
        logging.info(f"Skipping step. Using cached file: {output_path}")
    return output_path


def _upload_pdf_for_chat(input_path: Path, context: Dict) -> None:
    """Uploads a PDF for a chat step if it hasn't been uploaded yet.

    Args:
        input_path: The path to the input file for the chat step.
        context: The context for the current workflow run.
    """
    if input_path.suffix == ".pdf" and "initial_file_handle" not in context:
        logging.info(
            f"Chat step started with a PDF: '{input_path.name}'. Uploading to Gemini."
        )
        with Spinner("Uploading PDF for chat..."):
            try:
                file_handle = genai.upload_file(path=str(input_path))
                context["initial_file_handle"] = file_handle
                logging.info("File uploaded successfully for chat session.")
            except Exception as e:
                logging.error(f"Failed to upload PDF for chat: {e}", exc_info=True)
                raise


def _get_chat_turns(step: Dict) -> List[Dict]:
    """Determines if it's a single or multi-turn chat and returns the list of turns.

    Args:
        step: The configuration for the chat step.

    Returns:
        A list of turns for the chat.
    """
    if "turns" in step:
        return step["turns"]
    else:
        single_turn_step = step.copy()
        if "task" in single_turn_step:
            single_turn_step["prompt"] = single_turn_step.pop("task")
        return [single_turn_step]


def _gather_turn_files(
    turn: Dict, step_files: List[Path], context: Dict, prefix: str
) -> Tuple[List[Path], str]:
    """Gathers all files for a given turn and returns them as a sorted list and a concatenated string.

    Args:
        turn: The configuration for the current chat turn.
        step_files: A list of files from the step-level fileset.
        context: The context for the current workflow run.
        prefix: The prefix for the current run.

    Returns:
        A tuple containing a sorted list of paths to the gathered files and a concatenated string of their content.
    """
    turn_files: Set[Path] = set(step_files)
    if "fileset" in turn:
        fileset_config = turn["fileset"]
        base_dir_name = fileset_config.get("base_dir", ".")
        base_dir = Path(base_dir_name)
        for f in _gather_files(fileset_config, base_dir, prefix):
            turn_files.add(f)

    if "context_files" in turn:
        fileset_id = turn["context_files"]
        if fileset_id in context:
            for f in context[fileset_id]:
                turn_files.add(f)
        else:
            logging.warning(f"Fileset with ID '{fileset_id}' not found in context.")

    sorted_turn_files = sorted(list(turn_files))

    if not sorted_turn_files:
        return [], ""

    logging.info(
        f"Concatenating content from {len(sorted_turn_files)} files for this turn..."
    )
    content_parts = []
    for file_path in sorted_turn_files:
        if not file_path.exists():
            raise FileNotFoundError(f"Fileset file '{file_path}' not found.")
        logging.info(f"  -> Reading: {file_path.name}")
        content_parts.append(
            f"--- CONTENT FROM {file_path.name} ---\n\n{file_path.read_text(encoding='utf-8')}"
        )

    return sorted_turn_files, "\n\n".join(content_parts)


def _build_message_parts(
    turn_prompt_path: Path,
    input_path: Path,
    fileset_content: str,
    context: Dict,
    turn_index: int,
) -> List[Any]:
    """Constructs the message_parts list for the Gemini API call.

    Args:
        turn_prompt_path: The path to the prompt file for the current turn.
        input_path: The path to the input file for the current turn.
        fileset_content: The concatenated content of the fileset for the current turn.
        context: The context for the current workflow run.
        turn_index: The index of the current turn.

    Returns:
        A list of parts to be sent to the model's generate_content method.
    """
    if input_path.suffix == ".pdf":
        input_text = ""
        logging.info("Chat turn started with a PDF as input; using empty text as base.")
    elif not input_path.is_file():
        input_text = ""
        logging.info(
            "No valid input file provided or path is a directory; using empty text as base."
        )
    else:
        input_text = input_path.read_text(encoding="utf-8")

    message_parts = [
        turn_prompt_path.read_text(encoding="utf-8"),
        input_text,
        fileset_content,
    ]

    if turn_index == 0 and context.get("initial_file_handle"):
        logging.info("Attaching initial PDF context to the chat.")
        message_parts.append(context["initial_file_handle"])

    return message_parts


def _process_chat_turn(
    turn: Dict,
    config: Config,
    prefix: str,
    input_path: Path,
    history: List[Dict],
    context: Dict,
    force: bool,
    step_files: List[Path],
    turn_index: int,
) -> Path:
    """Processes a single chat turn.

    Args:
        turn: The configuration for the current chat turn.
        config: The global configuration object.
        prefix: The prefix for the current run.
        input_path: The path to the input file for this turn.
        history: The chat history.
        context: The context for the current workflow run.
        force: If True, forces regeneration of all files.
        step_files: A list of files from the step-level fileset.
        turn_index: The index of the current turn.

    Returns:
        The path to the output of the chat turn.
    """
    logging.info(
        f"-- Chat Turn {turn_index + 1}/{len(_get_chat_turns(config.get('workflow')[0]))} --"
    )

    output_path = _get_output_path(prefix, turn)

    # Auto-detect output extension based on json flag
    if turn.get("json") and output_path.suffix != ".json":
        output_path = output_path.with_suffix(".json")
        logging.info("JSON output detected, using .json extension")

    turn_prompt_path = Path(turn["prompt"])
    if not turn_prompt_path.exists():
        raise FileNotFoundError(
            f"Prompt file for chat turn '{turn_prompt_path}' not found."
        )

    dependencies = [input_path, turn_prompt_path]
    if "system_prompt" in turn:
        system_prompt_path = Path(turn["system_prompt"])
        if not system_prompt_path.exists():
            raise FileNotFoundError(
                f"System prompt file for chat turn '{system_prompt_path}' not found."
            )
        dependencies.append(system_prompt_path)

    turn_files, fileset_content = _gather_turn_files(turn, step_files, context, prefix)
    dependencies.extend(turn_files)

    message_parts = _build_message_parts(
        turn_prompt_path, input_path, fileset_content, context, turn_index
    )

    response_mime_type = None
    response_schema = None
    original_schema = None  # Keep the original schema for validation

    if turn.get("json"):
        response_mime_type = "application/json"
        logging.info("JSON output requested.")

    schema_path_str = turn.get("schema")
    if schema_path_str:
        schema_path = config.yaml_dir / schema_path_str
        if not schema_path.exists():
            raise FileNotFoundError(f"Schema file '{schema_path}' not found.")
        try:
            raw_schema_text = schema_path.read_text(encoding="utf-8")
            # Use lazy_load=False to get a plain dict directly
            raw_schema = jsonref.loads(raw_schema_text, lazy_load=False)

            # Keep original schema for validation
            original_schema = raw_schema.copy()

            # Clean the schema to be compatible with Gemini API
            response_schema = _clean_schema_for_gemini(raw_schema)

            dependencies.append(schema_path)
            logging.info(f"Schema loaded and cleaned for Gemini from '{schema_path}'.")
        except (json.JSONDecodeError, jsonref.JsonRefError) as e:
            raise ValueError(
                f"Invalid or unresolvable JSON in schema file '{schema_path}': {e}"
            )

    if is_stale(output_path, dependencies, force):
        turn_model_name = turn.get("model", config.model)
        turn_model = genai.GenerativeModel(turn_model_name)

        prompt_for_api = history + [{"role": "user", "parts": message_parts}]

        response_text = _call_gemini_api(
            turn_model,
            prompt_for_api,
            f"Running chat turn {turn_index + 1}...",
            response_mime_type=response_mime_type,
            response_schema=response_schema,
        )

        # Validate and fix JSON output against original schema if available
        if original_schema and JSONSCHEMA_AVAILABLE:
            try:
                response_json = json.loads(response_text)

                # Try validation first
                try:
                    jsonschema.validate(instance=response_json, schema=original_schema)
                    logging.info(
                        "✓ Generated JSON validates against the original schema."
                    )
                except jsonschema.ValidationError as e:
                    # Try to fix common type coercion issues
                    logging.warning(f"✗ Validation failed: {e.message}")
                    logging.info("Attempting to fix common type issues...")
                    fixed_json = _fix_json_types(response_json, original_schema)

                    # Try validation again with fixed JSON
                    try:
                        jsonschema.validate(instance=fixed_json, schema=original_schema)
                        logging.info("✓ JSON fixed and now validates against schema!")
                        # Save the fixed version
                        response_text = json.dumps(
                            fixed_json, ensure_ascii=False, indent=2
                        )
                    except jsonschema.ValidationError as e2:
                        logging.warning(
                            f"✗ Even after fixes, validation failed: {e2.message}"
                        )
                        logging.warning(
                            f"  Path: {' -> '.join(str(p) for p in e2.path)}"
                        )
                        logging.warning(
                            "Saving output anyway, but it may not match the expected schema."
                        )

            except json.JSONDecodeError as e:
                logging.error(f"✗ Generated output is not valid JSON: {e}")
                logging.warning("Saving output anyway, but it may not be valid JSON.")
            except jsonschema.SchemaError as e:
                logging.error(f"✗ Schema itself is invalid: {e}")

        output_path.write_text(response_text, encoding="utf-8")
        logging.info(f"--> Saved turn output to: {output_path}")
    else:
        logging.info(f"Skipping turn. Using cached file: {output_path}")
        response_text = output_path.read_text(encoding="utf-8")

    history.append({"role": "user", "parts": message_parts})
    history.append({"role": "model", "parts": [response_text]})

    return output_path


def _fix_json_types(data: Any, schema: Dict) -> Any:
    """Attempts to fix common type coercion issues in JSON data.

    Common issues:
    - Numbers as strings ("123" -> 123)
    - Booleans as strings ("true" -> true)

    Args:
        data: The JSON data to fix.
        schema: The schema defining expected types.

    Returns:
        Fixed JSON data with corrected types.
    """
    if not isinstance(schema, dict):
        return data

    expected_type = schema.get("type")

    # Fix integer/number types
    if expected_type in ["integer", "number"] and isinstance(data, str):
        try:
            return int(data) if expected_type == "integer" else float(data)
        except (ValueError, TypeError):
            return data

    # Fix boolean types
    if expected_type == "boolean" and isinstance(data, str):
        if data.lower() == "true":
            return True
        elif data.lower() == "false":
            return False

    # Recursively fix objects
    if expected_type == "object" and isinstance(data, dict):
        properties = schema.get("properties", {})
        fixed_data = {}
        for key, value in data.items():
            if key in properties:
                fixed_data[key] = _fix_json_types(value, properties[key])
            else:
                fixed_data[key] = value
        return fixed_data

    # Recursively fix arrays
    if expected_type == "array" and isinstance(data, list):
        items_schema = schema.get("items", {})
        return [_fix_json_types(item, items_schema) for item in data]

    # Handle oneOf by trying to fix against first option
    if "oneOf" in schema and isinstance(schema["oneOf"], list):
        for option_schema in schema["oneOf"]:
            try:
                fixed = _fix_json_types(data, option_schema)
                # Quick validation check if possible
                if JSONSCHEMA_AVAILABLE:
                    try:
                        jsonschema.validate(instance=fixed, schema=option_schema)
                        return fixed
                    except:
                        continue
                else:
                    return fixed
            except:
                continue
        return data

    return data


def _clean_schema_for_gemini(schema: Dict, depth: int = 0, max_depth: int = 3) -> Dict:
    """Cleans a JSON schema to make it compatible with Gemini API.

    Gemini API doesn't support:
    - oneOf, anyOf, allOf
    - $schema, title, description at root level
    - definitions, $defs
    - Recursive $ref references
    - Empty properties for OBJECT type

    This function removes unsupported fields and flattens the schema structure.
    It stops recursion at max_depth to prevent infinite recursion.

    Args:
        schema: The schema dictionary to clean.
        depth: Current recursion depth (internal use).
        max_depth: Maximum recursion depth before stopping.

    Returns:
        A cleaned schema dictionary compatible with Gemini API.
    """
    if not isinstance(schema, dict):
        return schema

    # Stop recursion if we've gone too deep (for recursive structures)
    if depth >= max_depth:
        # Return a permissive schema that accepts anything
        logging.debug(f"Max depth {max_depth} reached, using permissive schema")
        return {"type": "string", "description": "Recursively nested content"}

    cleaned = {}

    for key, value in schema.items():
        # Skip unsupported root-level and nested keys
        if key in ["$schema", "definitions", "$defs", "$ref"]:
            logging.debug(f"Removing unsupported schema key: {key}")
            continue

        # Remove title and description at root level only (keep them in properties)
        if key in ["title", "description"] and depth == 0 and "type" not in schema:
            logging.debug(f"Removing root-level schema key: {key}")
            continue

        # Handle oneOf by taking the first option
        if key == "oneOf":
            logging.info(f"Converting 'oneOf' to single schema (taking first option)")
            if isinstance(value, list) and len(value) > 0:
                # Clean the first option and merge it into parent
                first_option = _clean_schema_for_gemini(value[0], depth + 1, max_depth)
                # Merge properties from first option into current level
                for k, v in first_option.items():
                    if k not in cleaned:  # Don't overwrite existing keys
                        cleaned[k] = v
            continue

        # Handle anyOf similarly to oneOf
        if key == "anyOf":
            logging.info(f"Converting 'anyOf' to single schema (taking first option)")
            if isinstance(value, list) and len(value) > 0:
                first_option = _clean_schema_for_gemini(value[0], depth + 1, max_depth)
                for k, v in first_option.items():
                    if k not in cleaned:
                        cleaned[k] = v
            continue

        # Handle allOf by merging all schemas
        if key == "allOf":
            logging.info(f"Merging 'allOf' schemas")
            if isinstance(value, list):
                for item in value:
                    merged = _clean_schema_for_gemini(item, depth + 1, max_depth)
                    # Merge each schema, with later ones taking precedence
                    cleaned.update(merged)
            continue

        # Recursively clean nested structures
        if key == "properties" and isinstance(value, dict):
            cleaned_props = {
                k: _clean_schema_for_gemini(v, depth + 1, max_depth)
                for k, v in value.items()
            }
            # Only include properties if non-empty
            if cleaned_props:
                cleaned[key] = cleaned_props
        elif key == "items":
            if isinstance(value, dict):
                cleaned[key] = _clean_schema_for_gemini(value, depth + 1, max_depth)
            elif isinstance(value, list):
                # Array of schemas (tuple validation) - take first
                cleaned[key] = (
                    _clean_schema_for_gemini(value[0], depth + 1, max_depth)
                    if value
                    else {}
                )
            else:
                cleaned[key] = value
        elif isinstance(value, dict):
            cleaned[key] = _clean_schema_for_gemini(value, depth + 1, max_depth)
        elif isinstance(value, list):
            # Clean any dict items in arrays
            cleaned[key] = [
                (
                    _clean_schema_for_gemini(item, depth + 1, max_depth)
                    if isinstance(item, dict)
                    else item
                )
                for item in value
            ]
        else:
            cleaned[key] = value

    # Validate: if type is "object" and properties is empty or missing, remove type or add a default property
    if cleaned.get("type") == "object":
        if "properties" not in cleaned or not cleaned["properties"]:
            # For objects without properties, make them more permissive
            logging.debug(
                f"Found object without properties at depth {depth}, making permissive"
            )
            # Remove the strict object type constraint
            del cleaned["type"]
            # Add description to guide the model
            if "description" not in cleaned:
                cleaned["description"] = "A flexible object structure"

    return cleaned


def handle_chat_step(
    step: Dict,
    config: Config,
    prefix: str,
    input_path: Path,
    context: Dict,
    force: bool,
) -> Path:
    """Handles the 'chat' workflow step, supporting multi-turn and single-turn chats.

    Args:
        step: The configuration for the 'chat' step.
        config: The global configuration object.
        prefix: The prefix for the current run.
        input_path: The path to the input file for this step.
        context: The context for the current workflow run.
        force: If True, forces regeneration of all files.

    Returns:
        The path to the final output of the chat.
    """
    logging.info("\n[Workflow Step: chat]")

    # Determine the actual input for the chat
    if "input_file" in step:
        current_chat_input_path = Path(step["input_file"])
        if not current_chat_input_path.exists():
            raise FileNotFoundError(
                f"Input file for chat '{current_chat_input_path}' not found."
            )
        logging.info(f"Using specified input file: {current_chat_input_path}")
    else:
        current_chat_input_path = input_path
        if current_chat_input_path.is_file():
            logging.info(f"Using workflow input file: {current_chat_input_path}")

    _upload_pdf_for_chat(current_chat_input_path, context)

    history = []
    logging.info("Initialized chat history.")

    # Detect single-turn vs multi-turn
    if "turns" not in step:
        logging.info("Detected simplified single-turn chat syntax.")

    step_files = []
    if "turns" in step and "fileset" in step:
        fileset_config = step["fileset"]
        base_dir_name = fileset_config.get("base_dir", ".")
        base_dir = Path(base_dir_name)
        step_files.extend(_gather_files(fileset_config, base_dir, prefix))

    turns = _get_chat_turns(step)

    for i, turn_config in enumerate(turns):
        effective_turn = {**step, **turn_config}

        current_chat_input_path = _process_chat_turn(
            turn=effective_turn,
            config=config,
            prefix=prefix,
            input_path=current_chat_input_path,
            history=history,
            context=context,
            force=force,
            step_files=step_files,
            turn_index=i,
        )

        if effective_turn.get("clear_uploads") and "initial_file_handle" in context:
            logging.info(
                "Clearing initial file handle from context as per 'clear_uploads' directive."
            )
            del context["initial_file_handle"]

    return current_chat_input_path


def handle_gather_files_step(step: Dict, context: Dict, prefix: str):
    """Handles the 'gather_files' workflow step.

    Args:
        step: The configuration for the 'gather_files' step.
        context: The context for the current workflow run.
        prefix: The prefix for the current run.
    """
    logging.info("\n[Workflow Step: gather_files]")
    fileset_id = step["id"]
    logging.info(f"Gathering files for fileset with ID: '{fileset_id}'")

    base_dir_name = step.get("base_dir", ".")
    base_dir = Path(base_dir_name)

    gathered_files = _gather_files(step, base_dir, prefix)
    context[fileset_id] = gathered_files
    logging.info(
        f"Stored {len(gathered_files)} files in context with ID: '{fileset_id}'"
    )
