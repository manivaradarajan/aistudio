import logging
from pathlib import Path
from typing import Dict, Any

import google.generativeai as genai
from aksharamukha import transliterate

from .gemini_utils import _call_gemini_api
from .file_utils import _get_output_path, _gather_files, is_stale, OUTPUT_DIR
from .ui import Spinner

def handle_extract_text_step(step: Dict, config: Dict, prefix: str, input_pdf: Path, context: Dict, force: bool) -> Path:
    """
    Handles the 'extract_text_from_pdf' workflow step.
    """
    logging.info("\n[Workflow Step: extract_text_from_pdf]")
    output_path = _get_output_path(prefix, step)
    prompt_path = Path(step['prompt'])
    
    if is_stale(output_path, [input_pdf, prompt_path], force):
        logging.info(f"Uploading '{input_pdf.name}' and generating text with '{prompt_path.name}'.")
        model_name = step.get('model', config['model'])
        model = genai.GenerativeModel(model_name)
        
        spinner = Spinner("Uploading PDF...")
        spinner.start()
        try:
            file_handle = genai.upload_file(path=str(input_pdf))
            context['initial_file_handle'] = file_handle
            logging.info("File uploaded successfully. Context handle stored.")
        finally:
            spinner.stop()

        prompt_parts = [prompt_path.read_text(encoding='utf-8'), file_handle]
        response_text = _call_gemini_api(model, prompt_parts, "Generating text from PDF...")
        
        output_path.write_text(response_text, encoding='utf-8')
        logging.info(f"--> Saved output to: {output_path}")
    else:
        logging.info(f"Skipping step. Using cached file: {output_path}")
    return output_path

def handle_convert_script_step(step: Dict, prefix: str, input_path: Path, force: bool) -> Path:
    """Handles the 'convert_script' workflow step."""
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

def handle_chat_step(step: Dict, config: Dict, prefix: str, input_path: Path, context: Dict, force: bool) -> Path:
    """
    Handles the 'chat' workflow step, supporting multi-turn and single-turn chats.
    """
    logging.info("\n[Workflow Step: chat]")

    if input_path.suffix == '.pdf' and 'initial_file_handle' not in context:
        logging.info(f"Chat step started with a PDF: '{input_path.name}'. Uploading to Gemini.")
        spinner = Spinner("Uploading PDF for chat...")
        spinner.start()
        try:
            file_handle = genai.upload_file(path=str(input_path))
            context['initial_file_handle'] = file_handle
            logging.info("File uploaded successfully for chat session.")
        except Exception as e:
            spinner.stop()
            logging.error(f"Failed to upload PDF for chat: {e}", exc_info=True)
            raise
        finally:
            spinner.stop()

    history = []
    logging.info("Initialized chat history.")
    
    current_chat_input_path = input_path

    if 'turns' in step:
        turns = step['turns']
    else:
        turns = [step]
        logging.info("Detected simplified single-turn chat syntax.")

    for i, turn in enumerate(turns):
        logging.info(f"-- Chat Turn {i+1}/{len(turns)} --")
        turn_prompt_path = Path(turn['prompt'])
        output_path = _get_output_path(prefix, turn)
        
        dependencies = [current_chat_input_path, turn_prompt_path]
        fileset_content = ""
        
        turn_files = []
        if 'fileset' in turn:
            turn_files.extend(_gather_files(turn['fileset'], OUTPUT_DIR, prefix))

        if 'context_files' in turn:
            fileset_id = turn['context_files']
            if fileset_id in context:
                turn_files.extend(context[fileset_id])
            else:
                logging.warning(f"Fileset with ID '{fileset_id}' not found in context.")

        if turn_files:
            dependencies.extend(turn_files)
            logging.info(f"Concatenating content from {len(turn_files)} files for this turn...")
            content_parts = []
            for file_path in turn_files:
                logging.info(f"  -> Reading: {file_path.name}")
                content_parts.append(f"--- CONTENT FROM {file_path.name} ---\n\n{file_path.read_text(encoding='utf-8')}")
            fileset_content = "\n\n".join(content_parts)

        if current_chat_input_path.suffix == '.pdf':
            input_text = ""
            logging.info("Chat turn started with a PDF as input; using empty text as base.")
        else:
            input_text = current_chat_input_path.read_text(encoding='utf-8')

        message_parts = [
            turn_prompt_path.read_text(encoding='utf-8'),
            input_text,
            fileset_content
        ]

        if i == 0 and context.get('initial_file_handle'):
            logging.info("Attaching initial PDF context to the chat.")
            message_parts.append(context['initial_file_handle'])

        if is_stale(output_path, dependencies, force):
            turn_model_name = turn.get('model', config['model'])
            turn_model = genai.GenerativeModel(turn_model_name)

            prompt_for_api = history + [{'role': 'user', 'parts': message_parts}]

            response_text = _call_gemini_api(
                turn_model, 
                prompt_for_api, 
                f"Running chat turn {i+1}..."
            )
            
            output_path.write_text(response_text, encoding='utf-8')
            logging.info(f"--> Saved turn output to: {output_path}")
        else:
            logging.info(f"Skipping turn. Using cached file: {output_path}")
            response_text = output_path.read_text(encoding='utf-8')

        history.append({'role': 'user', 'parts': message_parts})
        history.append({'role': 'model', 'parts': [response_text]})
        
        current_chat_input_path = output_path

        if turn.get('clear_uploads') and 'initial_file_handle' in context:
            logging.info("Clearing initial file handle from context as per 'clear_uploads' directive.")
            del context['initial_file_handle']

    return current_chat_input_path

def handle_gather_files_step(step: Dict, context: Dict, prefix: str):
    """
    Handles the 'gather_files' workflow step.
    """
    logging.info("\n[Workflow Step: gather_files]")
    fileset_id = step['id']
    logging.info(f"Gathering files for fileset with ID: '{fileset_id}'")
    
    base_dir_name = step.get('base_dir', 'output')
    base_dir = OUTPUT_DIR if base_dir_name == 'output' else Path('.')

    gathered_files = _gather_files(step, base_dir, prefix)
    context[fileset_id] = gathered_files
    logging.info(f"Stored {len(gathered_files)} files in context with ID: '{fileset_id}'")
