import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple, Set

import google.generativeai as genai
from aksharamukha import transliterate

from .config import Config
from .gemini_utils import _call_gemini_api
from .file_utils import _get_output_path, _gather_files, is_stale, OUTPUT_DIR
from .ui import Spinner


def handle_extract_text_step(step: Dict, config: Config, prefix: str, input_pdf: Path, context: Dict, force: bool) -> Path:
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
    prompt_path = Path(step['prompt'])
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file '{prompt_path}' not found.")
    
    if is_stale(output_path, [input_pdf, prompt_path], force):
        logging.info(f"Uploading '{input_pdf.name}' and generating text with '{prompt_path.name}'.")
        model_name = step.get('model', config.model)
        model = genai.GenerativeModel(model_name)
        
        with Spinner("Uploading PDF..."):
            file_handle = genai.upload_file(path=str(input_pdf))
            context['initial_file_handle'] = file_handle
            logging.info("File uploaded successfully. Context handle stored.")

        prompt_parts = [prompt_path.read_text(encoding='utf-8'), file_handle]
        response_text = _call_gemini_api(model, prompt_parts, "Extracting text from PDF...")
        
        output_path.write_text(response_text, encoding='utf-8')
        logging.info(f"--> Saved output to: {output_path}")
    else:
        logging.info(f"Skipping step. Using cached file: {output_path}")
    return output_path


def handle_convert_script_step(step: Dict, prefix: str, input_path: Path, force: bool) -> Path:
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
        logging.info(f"Converting '{input_path.name}' from {step['from']} to {step['to']}.")
        input_text = input_path.read_text(encoding='utf-8')
        converted_text = transliterate.process(step['from'], step['to'], input_text)
        output_path.write_text(converted_text, encoding='utf-8')
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
    if input_path.suffix == '.pdf' and 'initial_file_handle' not in context:
        logging.info(f"Chat step started with a PDF: '{input_path.name}'. Uploading to Gemini.")
        with Spinner("Uploading PDF for chat..."):
            try:
                file_handle = genai.upload_file(path=str(input_path))
                context['initial_file_handle'] = file_handle
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
    if 'turns' in step:
        return step['turns']
    else:
        logging.info("Detected simplified single-turn chat syntax.")
        return [step]


def _gather_turn_files(turn: Dict, step_files: List[Path], context: Dict, prefix: str) -> Tuple[List[Path], str]:
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
    if 'fileset' in turn:
        fileset_config = turn['fileset']
        base_dir_name = fileset_config.get('base_dir', '.')
        base_dir = Path(base_dir_name)
        for f in _gather_files(fileset_config, base_dir, prefix):
            turn_files.add(f)

    if 'context_files' in turn:
        fileset_id = turn['context_files']
        if fileset_id in context:
            for f in context[fileset_id]:
                turn_files.add(f)
        else:
            logging.warning(f"Fileset with ID '{fileset_id}' not found in context.")

    sorted_turn_files = sorted(list(turn_files))
    
    if not sorted_turn_files:
        return [], ""

    logging.info(f"Concatenating content from {len(sorted_turn_files)} files for this turn...")
    content_parts = []
    for file_path in sorted_turn_files:
        if not file_path.exists():
            raise FileNotFoundError(f"Fileset file '{file_path}' not found.")
        logging.info(f"  -> Reading: {file_path.name}")
        content_parts.append(f"--- CONTENT FROM {file_path.name} ---\n\n{file_path.read_text(encoding='utf-8')}")
    
    return sorted_turn_files, "\n\n".join(content_parts)


def _build_message_parts(turn_prompt_path: Path, input_path: Path, fileset_content: str, context: Dict, turn_index: int) -> List[Any]:
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
    if input_path.suffix == '.pdf':
        input_text = ""
        logging.info("Chat turn started with a PDF as input; using empty text as base.")
    elif not input_path.is_file():
        input_text = ""
        logging.info("No valid input file provided or path is a directory; using empty text as base.")
    else:
        input_text = input_path.read_text(encoding='utf-8')

    message_parts = [
        turn_prompt_path.read_text(encoding='utf-8'),
        input_text,
        fileset_content
    ]

    if turn_index == 0 and context.get('initial_file_handle'):
        logging.info("Attaching initial PDF context to the chat.")
        message_parts.append(context['initial_file_handle'])
        
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
    turn_index: int
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
    logging.info(f"-- Chat Turn {turn_index + 1}/{len(_get_chat_turns(config.get('workflow')[0]))} --")
    
    output_path = _get_output_path(prefix, turn)
    turn_prompt_path = Path(turn['prompt'])
    if not turn_prompt_path.exists():
        raise FileNotFoundError(f"Prompt file for chat turn '{turn_prompt_path}' not found.")

    dependencies = [input_path, turn_prompt_path]
    if 'system_prompt' in turn:
        system_prompt_path = Path(turn['system_prompt'])
        if not system_prompt_path.exists():
            raise FileNotFoundError(f"System prompt file for chat turn '{system_prompt_path}' not found.")
        dependencies.append(system_prompt_path)

    turn_files, fileset_content = _gather_turn_files(turn, step_files, context, prefix)
    dependencies.extend(turn_files)

    message_parts = _build_message_parts(turn_prompt_path, input_path, fileset_content, context, turn_index)

    if is_stale(output_path, dependencies, force):
        turn_model_name = turn.get('model', config.model)
        turn_model = genai.GenerativeModel(turn_model_name)

        prompt_for_api = history + [{'role': 'user', 'parts': message_parts}]

        response_text = _call_gemini_api(
            turn_model,
            prompt_for_api,
            f"Running chat turn {turn_index + 1}..."
        )
        
        output_path.write_text(response_text, encoding='utf-8')
        logging.info(f"--> Saved turn output to: {output_path}")
    else:
        logging.info(f"Skipping turn. Using cached file: {output_path}")
        response_text = output_path.read_text(encoding='utf-8')

    history.append({'role': 'user', 'parts': message_parts})
    history.append({'role': 'model', 'parts': [response_text]})
    
    return output_path


def handle_chat_step(step: Dict, config: Config, prefix: str, input_path: Path, context: Dict, force: bool) -> Path:
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
    
    _upload_pdf_for_chat(input_path, context)

    history = []
    logging.info("Initialized chat history.")
    current_chat_input_path = input_path
    
    if 'input_file' in step:
        current_chat_input_path = Path(step['input_file'])
        if not current_chat_input_path.exists():
            raise FileNotFoundError(f"Input file for chat '{current_chat_input_path}' not found.")
        current_chat_input_path = input_path

    step_files = []
    if 'turns' in step and 'fileset' in step:
        fileset_config = step['fileset']
        base_dir_name = fileset_config.get('base_dir', '.')
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
            turn_index=i
        )

        if effective_turn.get('clear_uploads') and 'initial_file_handle' in context:
            logging.info("Clearing initial file handle from context as per 'clear_uploads' directive.")
            del context['initial_file_handle']

    return current_chat_input_path


def handle_gather_files_step(step: Dict, context: Dict, prefix: str):
    """Handles the 'gather_files' workflow step.

    Args:
        step: The configuration for the 'gather_files' step.
        context: The context for the current workflow run.
        prefix: The prefix for the current run.
    """
    logging.info("\n[Workflow Step: gather_files]")
    fileset_id = step['id']
    logging.info(f"Gathering files for fileset with ID: '{fileset_id}'")
    
    base_dir_name = step.get('base_dir', '.')
    base_dir = Path(base_dir_name)

    gathered_files = _gather_files(step, base_dir, prefix)
    context[fileset_id] = gathered_files
    logging.info(f"Stored {len(gathered_files)} files in context with ID: '{fileset_id}'")
