/**
 * AI Assistant for Google Docs with Context Persistence - Add-on Version
 * 
 * INSTALLATION:
 * 1. Create a standalone Apps Script project at script.google.com
 * 2. Copy this code into the project
 * 3. Set GEMINI_API_KEY in Project Settings > Script Properties
 * 4. Configure appsscript.json manifest for an Add-on
 * 5. Link to a GCP project and configure OAuth Consent Screen
 * 6. Create a test deployment to install and share
 * 
 * REQUIRED TABS (all optional except one must have content):
 * - System Prompt: AI instructions
 * - Task: What you want done
 * - Parameters: Configuration (USE_CONTEXT: true/false)
 * - Input: File IDs and URLs (format: file:ID, folder:ID, url:URL, or https://...)
 * - AI Output: Where responses are written (auto-created)
 * - Context History: Conversation state (auto-created)
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  TABS: {
    SYSTEM_PROMPT: 'System Prompt',
    TASK: 'Task',
    PARAMETERS: 'Parameters',
    INPUT: 'Input',
    OUTPUT: 'AI Output',
    CONTEXT_HISTORY: 'Context History'
  },
  GEMINI_MODEL: 'gemini-2.0-pro', // Fast model by default
  API_KEY_PROPERTY: 'GEMINI_API_KEY',
  MAX_FILE_SIZE: 50000,
  MAX_CONTEXT_TURNS: 10,
  MAX_EXECUTION_TIME: 300000, // 5 minutes (leave 1 min buffer)
  SUPPORTED_MIME_TYPES: {
    // Images
    'image/png': true, 'image/jpeg': true, 'image/webp': true,
    'image/heic': true, 'image/heif': true,
    // Videos
    'video/mp4': true, 'video/mpeg': true, 'video/quicktime': true,
    'video/x-msvideo': true, 'video/webm': true, 'video/3gpp': true,
    // Audio
    'audio/wav': true, 'audio/mp3': true, 'audio/aiff': true,
    'audio/aac': true, 'audio/ogg': true, 'audio/flac': true,
    // Documents
    'application/pdf': true, 'text/plain': true, 'text/html': true,
    'text/css': true, 'text/javascript': true, 'text/csv': true,
    'text/markdown': true, 'application/json': true, 'text/xml': true,
    'application/rtf': true, 'text/rtf': true,
    // Code
    'text/x-python': true, 'application/x-python-code': true,
    'text/x-typescript': true, 'application/x-typescript': true,
    'application/x-javascript': true
  }
};

// ============================================================================
// ADD-ON UI & MAIN WORKFLOW
// ============================================================================

/**
 * Renders the add-on's homepage in Google Docs.
 * This function is specified in the manifest and is the entry point.
 * @param {Object} e The event object.
 * @return {Card} The card to display.
 */
function onDocsHomepage(e) {
  const builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle('AI Assistant'));

  const section = CardService.newCardSection();
  
  section.addWidget(CardService.newTextParagraph()
    .setText('This assistant reads context from tabs in this document (System Prompt, Task, etc.) and uses the Gemini API to generate a response.')
  );
  
  section.addWidget(CardService.newButtonSet()
    .addButton(CardService.newTextButton()
      .setText('✨ Run AI Assistant')
      .setOnClickAction(CardService.newAction().setFunctionName('main')))
    .addButton(CardService.newTextButton()
      .setText('🔄 Clear Context')
      .setOnClickAction(CardService.newAction().setFunctionName('clearContextHistory')))
  );

  builder.addSection(section);
  return builder.build();
}


function main() {
  const doc = DocumentApp.getActiveDocument();
  const logs = [];
  
  try {
    logs.push('🔍 Reading configuration...');
    const config = readConfiguration(doc);
    logs.push(`✓ System Prompt: ${config.systemPrompt ? 'Yes' : 'No'}`);
    logs.push(`✓ Task: ${config.task ? 'Yes' : 'No'}`);
    logs.push(`✓ Inputs: ${config.inputs.length}`);
    logs.push(`✓ Context enabled: ${config.useContext}`);
    
    // Validate we have something to process
    if (!config.systemPrompt && !config.task && config.inputs.length === 0) {
      return showError('Nothing to process! Provide at least: System Prompt, Task, or Input sources.');
    }

    logs.push('\n📁 Setting up tabs...');
    ensureTab(doc, CONFIG.TABS.OUTPUT);
    ensureTab(doc, CONFIG.TABS.CONTEXT_HISTORY);
    logs.push('✓ Tabs ready');

    // Write initial progress to output tab
    writeProgressToOutput(doc, 'Starting AI Assistant...\n' + logs.join('\n'));

    // Process inputs
    logs.push('\n📥 Processing inputs...');
    writeProgressToOutput(doc, logs.join('\n'));
    
    const fileContents = config.inputs.length ? processInputSources(config.inputs, logs, doc) : [];
    logs.push(`✓ Processed ${fileContents.length} file(s)`);
    writeProgressToOutput(doc, logs.join('\n'));

    // Load context if needed
    if (config.useContext) {
      logs.push('\n💭 Loading conversation context...');
      writeProgressToOutput(doc, logs.join('\n'));
      const history = loadContext(doc);
      logs.push(`✓ Loaded ${history.length / 2} previous turn(s)`);
      var contextHistory = history;
    } else {
      var contextHistory = [];
    }
    
    // Build and send prompt
    logs.push('\n🤖 Calling Gemini API...');
    logs.push(`   Model: ${config.geminiModel}`);
    writeProgressToOutput(doc, logs.join('\n'));
    
    const promptData = buildPrompt(config, fileContents);
    const response = callGeminiApi(promptData, contextHistory, config.useContext, config.geminiModel);
    logs.push(`✓ Received response (${response.length} chars)`);

    // Save context and output
    if (config.useContext) {
      logs.push('\n💾 Saving context...');
      saveContext(doc, promptData.textPrompt, response);
      logs.push('✓ Context saved');
    }
    
    logs.push('\n📝 Writing final output...');
    writeOutput(doc, response, config.useContext);
    logs.push('✓ Output written to AI Output tab');
    
    // Show success with logs
    return showLogs(logs, true);

  } catch (error) {
    Logger.log(error.stack);
    logs.push(`\n❌ ERROR: ${error.message}`);
    return showLogsWithError(logs, error.message);
  }
}

function clearContextHistory() {
  try {
    const doc = DocumentApp.getActiveDocument();
    clearContext(doc);
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
            .setText('✅ Context history cleared.'))
        .build();
  } catch (error) {
    return showError(error.message);
  }
}

// ============================================================================
// ERROR DISPLAY
// ============================================================================

/**
 * Shows a detailed error modal with copyable text
 */
function showError(message) {
  const errorCard = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('❌ Error'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText(`<b>Error Details:</b><br><br>${message.replace(/\n/g, '<br>')}`))
      .addWidget(CardService.newTextInput()
        .setFieldName('error_text')
        .setValue(message)
        .setTitle('Copy error text:')
        .setMultiline(true))
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('Close')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('closeErrorCard')))))
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(errorCard))
    .build();
}

/**
 * Closes the error card and returns to main view
 */
function closeErrorCard() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

/**
 * Shows execution logs in a card
 */
function showLogs(logs, success) {
  const logText = logs.join('\n');
  
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(success ? '✅ Success' : '📋 Execution Log'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText(`<font face="monospace">${logText.replace(/\n/g, '<br>')}</font>`))
      .addWidget(CardService.newTextInput()
        .setFieldName('log_text')
        .setValue(logText)
        .setTitle('Copy logs:')
        .setMultiline(true))
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('Close')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('closeErrorCard')))))
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * Shows logs with error details
 */
function showLogsWithError(logs, errorMessage) {
  const logText = logs.join('\n');
  const fullText = `${logText}\n\n${'='.repeat(50)}\nFULL ERROR:\n${errorMessage}`;
  
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('❌ Error'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText(`<font face="monospace">${logText.replace(/\n/g, '<br>')}</font>`))
      .addWidget(CardService.newTextParagraph()
        .setText(`<br><b>Full Error:</b><br>${errorMessage.replace(/\n/g, '<br>')}`))
      .addWidget(CardService.newTextInput()
        .setFieldName('error_text')
        .setValue(fullText)
        .setTitle('Copy full log:')
        .setMultiline(true))
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('Close')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('closeErrorCard')))))
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

// ============================================================================
// CONFIGURATION READING
// ============================================================================

function readConfiguration(doc) {
  const params = parseParameters(readTabOptional(doc, CONFIG.TABS.PARAMETERS));
  
  return {
    systemPrompt: readTabOptional(doc, CONFIG.TABS.SYSTEM_PROMPT),
    task: readTabOptional(doc, CONFIG.TABS.TASK),
    params: params,
    inputs: parseInputs(readTabOptional(doc, CONFIG.TABS.INPUT)),
    get useContext() { 
      return this.params.USE_CONTEXT === 'true' || this.params.USE_CONTEXT === 'yes'; 
    },
    get geminiModel() {
      return this.params.GEMINI_MODEL || CONFIG.GEMINI_MODEL;
    }
  };
}

function parseParameters(text) {
  if (!text) return {};
  const params = {};
  text.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key && value) params[key] = value;
    }
  });
  return params;
}

function parseInputs(text) {
  if (!text) return [];
  const inputs = [];
  
  text.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    if (line.startsWith('file:')) {
      inputs.push({type: 'file', value: line.substring(5).trim()});
    } else if (line.startsWith('folder:')) {
      inputs.push({type: 'folder', value: line.substring(7).trim()});
    } else if (line.startsWith('url:') || line.startsWith('http')) {
      let url = line.startsWith('url:') ? line.substring(4).trim() : line;
      
      // Extract file ID from Google Drive URLs
      if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/[-\w]{25,}/);
        if (fileIdMatch) {
          inputs.push({type: 'file', value: fileIdMatch[0]});
          return;
        }
      }
      
      inputs.push({type: 'url', value: url});
    } else {
      Logger.log(`Skipping unrecognized input: ${line}`);
    }
  });
  
  return inputs;
}

// ============================================================================
// TAB OPERATIONS
// ============================================================================

function readTabOptional(doc, tabName) {
  try {
    const tab = doc.getTabs().find(t => t.getTitle() === tabName);
    return tab ? tab.asDocumentTab().getBody().getText().trim() : '';
  } catch (error) {
    Logger.log(`Cannot read tab "${tabName}": ${error.message}`);
    return '';
  }
}

function ensureTab(doc, tabName) {
  const tabs = doc.getTabs();
  if (!tabs.find(t => t.getTitle() === tabName)) {
    const newTab = doc.addTab(tabName);
    const body = newTab.asDocumentTab().getBody();
    body.appendParagraph(tabName).setHeading(DocumentApp.ParagraphHeading.TITLE);
    if (tabName === CONFIG.TABS.CONTEXT_HISTORY) {
      body.appendParagraph('Auto-managed. Do not edit manually.');
    }
  }
}

function writeOutput(doc, content, isContextual) {
  const tab = doc.getTabs().find(t => t.getTitle() === CONFIG.TABS.OUTPUT);
  if (!tab) throw new Error(`Tab "${CONFIG.TABS.OUTPUT}" not found.`);
  
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const body = tab.asDocumentTab().getBody();
  
  if (body.getNumChildren() > 0) {
    body.appendParagraph('').appendHorizontalRule();
  }
  
  const header = isContextual ? `${timestamp} (with context)` : timestamp;
  body.appendParagraph(header).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(content || 'No content returned.');
  
  return timestamp;
}

/**
 * Writes progress updates to the AI Output tab in real-time
 */
function writeProgressToOutput(doc, progressText) {
  try {
    const tab = doc.getTabs().find(t => t.getTitle() === CONFIG.TABS.OUTPUT);
    if (!tab) return;
    
    const body = tab.asDocumentTab().getBody();
    
    // Clear and write progress
    body.clear();
    body.appendParagraph('🔄 Processing...').setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph(progressText);
    body.appendParagraph('\n[This will be replaced with final output when complete]');
    
    // Force a save to make it visible
    doc.saveAndClose();
    DocumentApp.openById(doc.getId()); // Reopen to continue
  } catch (error) {
    // Silently fail - progress updates are optional
    Logger.log(`Progress update failed: ${error.message}`);
  }
}

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

function loadContext(doc) {
  try {
    const tab = doc.getTabs().find(t => t.getTitle() === CONFIG.TABS.CONTEXT_HISTORY);
    if (!tab) return [];
    
    const text = tab.asDocumentTab().getBody().getText();
    const markerIndex = text.indexOf('--- CONTEXT DATA ---');
    if (markerIndex === -1) return [];
    
    const jsonStr = text.substring(markerIndex + 20).trim();
    if (!jsonStr) return [];
    
    const history = JSON.parse(jsonStr);
    return history.length > CONFIG.MAX_CONTEXT_TURNS * 2 
      ? history.slice(-CONFIG.MAX_CONTEXT_TURNS * 2) 
      : history;
  } catch (error) {
    Logger.log(`Context load failed: ${error.message}`);
    return [];
  }
}

function saveContext(doc, userPrompt, modelResponse) {
  try {
    const history = loadContext(doc);
    history.push(
      {role: 'user', parts: [{text: userPrompt}]},
      {role: 'model', parts: [{text: modelResponse}]}
    );
    
    const trimmed = history.length > CONFIG.MAX_CONTEXT_TURNS * 2 
      ? history.slice(-CONFIG.MAX_CONTEXT_TURNS * 2) 
      : history;
    
    const tab = doc.getTabs().find(t => t.getTitle() === CONFIG.TABS.CONTEXT_HISTORY);
    const body = tab.asDocumentTab().getBody();
    body.clear();
    
    body.appendParagraph('Conversation Context History').setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph('Auto-managed. Do not edit manually.');
    body.appendParagraph(`Updated: ${new Date().toLocaleString()}`);
    body.appendParagraph(`Turns: ${trimmed.length / 2}`);
    body.appendParagraph('--- CONTEXT DATA ---');
    body.appendParagraph(JSON.stringify(trimmed, null, 2));
  } catch (error) {
    Logger.log(`Context save failed: ${error.message}`);
  }
}

function clearContext(doc) {
  const tab = doc.getTabs().find(t => t.getTitle() === CONFIG.TABS.CONTEXT_HISTORY);
  if (tab) {
    const body = tab.asDocumentTab().getBody();
    body.clear();
    body.appendParagraph('Conversation Context History').setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph('Context cleared.');
  }
}

// ============================================================================
// INPUT PROCESSING
// ============================================================================

function processInputSources(sources, logs, doc) {
  const results = [];
  
  sources.forEach((source, idx) => {
    if (logs) logs.push(`  [${idx + 1}/${sources.length}] Processing ${source.type}: ${source.value.substring(0, 50)}...`);
    if (doc) writeProgressToOutput(doc, logs.join('\n'));
    
    try {
      if (source.type === 'file') {
        const data = getFileContent(source.value);
        results.push(...data);
        if (logs) logs.push(`    ✓ Got ${data.length} file(s)`);
      } else if (source.type === 'folder') {
        const data = getFolderContents(source.value);
        results.push(...data);
        if (logs) logs.push(`    ✓ Got ${data.length} file(s) from folder`);
      } else if (source.type === 'url') {
        const data = fetchUrl(source.value);
        results.push(data);
        if (logs) logs.push(`    ✓ Fetched URL`);
      }
      
      if (doc) writeProgressToOutput(doc, logs.join('\n'));
      
    } catch (error) {
      Logger.log(`Error processing ${source.type}:${source.value} - ${error.message}`);
      if (logs) logs.push(`    ❌ FATAL ERROR: ${error.message}`);
      if (doc) writeProgressToOutput(doc, logs.join('\n'));
      
      // All input errors are now fatal - abort immediately
      throw new Error(`Failed to read input [${idx + 1}/${sources.length}]: ${source.type}:${source.value}\n\nError: ${error.message}\n\nAborting to avoid wasting API calls with incomplete data.`);
    }
  });
  
  return results;
}

function getFileContent(fileId) {
  try {
    Logger.log(`Attempting to access file: ${fileId}`);
    
    // Use Drive API v3 instead of DriveApp for better add-on compatibility
    let file, mimeType, fileName;
    
    try {
      // Get file metadata using Drive API
      const token = ScriptApp.getOAuthToken();
      const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`;
      const metadataResponse = UrlFetchApp.fetch(metadataUrl, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      });
      
      if (metadataResponse.getResponseCode() !== 200) {
        throw new Error(`Drive API returned ${metadataResponse.getResponseCode()}: ${metadataResponse.getContentText()}`);
      }
      
      const metadata = JSON.parse(metadataResponse.getContentText());
      fileName = metadata.name;
      mimeType = metadata.mimeType;
      
      Logger.log(`File found via API: ${fileName}, MimeType: ${mimeType}`);
    } catch (e) {
      Logger.log(`Drive API access failed: ${e.message}`);
      throw new Error(`Cannot access file with ID: ${fileId}\n\nError: ${e.message}\n\nPossible issues:\n1. File ID is incorrect\n2. File was deleted\n3. You don't have permission to access this file\n4. Add-on needs re-authorization\n\nTry: Make sure the file is in your Drive and you have access to it.`);
    }
    
    // Check if supported by Gemini
    if (!CONFIG.SUPPORTED_MIME_TYPES[mimeType]) {
      throw new Error(`Unsupported file type: ${mimeType} for file: ${fileName}\n\nSupported types: PDF, images, audio, video, text files, code files.`);
    }
    
    // Handle Google Workspace files - still need DriveApp for these
    if (mimeType === MimeType.GOOGLE_DOCS) {
      try {
        return [{name: fileName, content: DocumentApp.openById(fileId).getBody().getText(), mimeType: 'text/plain'}];
      } catch (e) {
        throw new Error(`Cannot open Google Doc: ${fileName}\n\nError: ${e.message}`);
      }
    }
    
    if (mimeType === MimeType.GOOGLE_SHEETS) {
      try {
        const sheet = SpreadsheetApp.openById(fileId);
        let content = '';
        sheet.getSheets().forEach(s => {
          content += `Sheet: ${s.getName()}\n`;
          content += s.getDataRange().getValues().map(row => row.join('\t')).join('\n') + '\n\n';
        });
        return [{name: fileName, content, mimeType: 'text/plain'}];
      } catch (e) {
        throw new Error(`Cannot open Google Sheet: ${fileName}\n\nError: ${e.message}`);
      }
    }
    
    if (mimeType === MimeType.GOOGLE_SLIDES) {
      try {
        const pres = SlidesApp.openById(fileId);
        let content = `Presentation: ${pres.getName()}\n\n`;
        pres.getSlides().forEach((slide, i) => {
          content += `Slide ${i + 1}:\n`;
          slide.getPageElements().forEach(el => {
            try {
              const shape = el.asShape();
              if (shape && shape.getText()) content += shape.getText().asString() + '\n';
            } catch (e) {
              // Ignore elements that are not shapes with text
            }
          });
          content += '\n';
        });
        return [{name: fileName, content, mimeType: 'text/plain'}];
      } catch (e) {
        throw new Error(`Cannot open Google Slides: ${fileName}\n\nError: ${e.message}`);
      }
    }
    
    // For binary files (PDF, images, etc.), download via Drive API
    try {
      Logger.log(`Downloading binary file via Drive API...`);
      const token = ScriptApp.getOAuthToken();
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      
      const downloadResponse = UrlFetchApp.fetch(downloadUrl, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      });
      
      if (downloadResponse.getResponseCode() !== 200) {
        throw new Error(`Download failed with status ${downloadResponse.getResponseCode()}: ${downloadResponse.getContentText()}`);
      }
      
      Logger.log(`Downloaded successfully`);
      
      // Text-based files
      if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('python')) {
        return [{name: fileName, content: downloadResponse.getContentText(), mimeType}];
      }
      
      // Binary files
      const bytes = downloadResponse.getContent();
      Logger.log(`Got ${bytes.length} bytes, encoding to base64...`);
      const encoded = Utilities.base64Encode(bytes);
      Logger.log(`Encoded successfully, length: ${encoded.length}`);
      
      return [{
        name: fileName,
        content: null,
        mimeType,
        inlineData: {
          mimeType,
          data: encoded
        }
      }];
    } catch (e) {
      Logger.log(`File download failed: ${e.message}`);
      throw new Error(`Cannot download file: ${fileName}\n\nError: ${e.message}`);
    }
  } catch (error) {
    Logger.log(`getFileContent final error: ${error.message}`);
    if (error.message.includes('Cannot')) {
      throw error;
    }
    throw new Error(`Unexpected error reading file ${fileId}: ${error.message}`);
  }
}

function getFolderContents(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const contents = [];
  const files = folder.getFiles();
  
  while (files.hasNext()) {
    try {
      contents.push(...getFileContent(files.next().getId()));
    } catch (e) {
      Logger.log(`Skipping file: ${e.message}`);
    }
  }
  
  return contents;
}

function fetchUrl(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`HTTP ${response.getResponseCode()}: Unable to fetch URL`);
  }
  
  const contentType = response.getHeaders()['Content-Type'] || 'text/html';
  let mimeType = 'text/html';
  if (contentType.includes('text/plain')) mimeType = 'text/plain';
  else if (contentType.includes('application/json')) mimeType = 'application/json';
  else if (contentType.includes('text/markdown')) mimeType = 'text/markdown';
  
  return {name: url, content: response.getContentText(), mimeType};
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

function buildPrompt(config, fileContents) {
  let text = '';
  
  if (config.systemPrompt) text += `System Prompt: ${config.systemPrompt}\n\n`;
  if (config.task) text += `Task: ${config.task}\n\n`;
  
  const relevantParams = Object.entries(config.params).filter(([k]) => k !== 'USE_CONTEXT');
  if (relevantParams.length > 0) {
    text += 'Parameters:\n';
    relevantParams.forEach(([k, v]) => text += `- ${k}: ${v}\n`);
    text += '\n';
  }
  
  if (fileContents.length > 0) {
    if (config.systemPrompt || config.task) {
      text += `Process ${fileContents.length} input(s):\n\n`;
    }
  }
  
  const parts = text ? [{text}] : [];
  
  fileContents.forEach(file => {
    if (file.inlineData) {
      parts.push({text: `\n--- FILE: ${file.name} (${file.mimeType}) ---\n`});
      parts.push({inlineData: file.inlineData});
    } else if (file.content) {
      const content = file.content.length > CONFIG.MAX_FILE_SIZE
        ? file.content.substring(0, CONFIG.MAX_FILE_SIZE) + '\n\n[truncated]'
        : file.content;
      const label = file.name.startsWith('http') ? 'URL' : 'FILE';
      parts.push({text: `\n--- ${label}: ${file.name} ---\n${content}\n--- END ---\n`});
    }
  });
  
  if (parts.length === 0) parts.push({text: 'Hello'});
  
  return {textPrompt: text, parts};
}

// ============================================================================
// GEMINI API
// ============================================================================

function callGeminiApi(promptData, history, useContext, modelName) {
  const startTime = Date.now();
  const apiKey = PropertiesService.getScriptProperties().getProperty(CONFIG.API_KEY_PROPERTY);
  if (!apiKey) throw new Error(`Set '${CONFIG.API_KEY_PROPERTY}' in script properties.`);

  const model = modelName || CONFIG.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const contents = useContext && history.length > 0 ? [...history] : [];
  contents.push({role: 'user', parts: promptData.parts});
  
  Logger.log(`Calling Gemini API with model: ${model}`);
  Logger.log(`Request size: ${JSON.stringify(contents).length} chars`);
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({contents}),
      muteHttpExceptions: true,
      validateHttpsCertificates: true
      // Note: Apps Script doesn't support custom timeout, max is ~6 minutes total execution
    });
    
    const elapsed = (Date.now() - startTime) / 1000;
    Logger.log(`API call completed in ${elapsed.toFixed(1)}s`);
    
    const code = response.getResponseCode();
    const body = response.getContentText();
    
    if (code === 429) throw new Error('Rate limit exceeded. Wait and retry.');
    if (code === 403) throw new Error('Invalid API key. Check GEMINI_API_KEY in script properties.');
    if (code === 400) {
      const detail = tryParseJson(body)?.error?.message || body;
      throw new Error(`Bad request: ${detail}`);
    }
    if (code === 504 || code === 503) {
      throw new Error(`Gemini API timeout (${code}). The file may be too large or complex.\n\nTry:\n1. Use gemini-2.0-flash-exp (much faster)\n2. Simplify your task prompt\n3. Process smaller sections`);
    }
    if (code !== 200) throw new Error(`API error ${code}: ${body}`);
    
    const json = JSON.parse(body);
    if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
      const responseText = json.candidates[0].content.parts[0].text;
      Logger.log(`Response received: ${responseText.length} chars`);
      return responseText;
    }
    
    const reason = json.candidates?.[0]?.finishReason || 'Unknown';
    const safety = json.candidates?.[0]?.safetyRatings || [];
    return `Response blocked.\nReason: ${reason}\nSafety: ${JSON.stringify(safety)}`;
  } catch (error) {
    const elapsed = (Date.now() - startTime) / 1000;
    
    // Check if we hit Apps Script execution time limit
    if (error.message.includes('time') || elapsed > 300) {
      throw new Error(`Execution timeout after ${elapsed.toFixed(0)}s.\n\nApps Script has a 6-minute limit. For large PDFs:\n1. Use GEMINI_MODEL: gemini-2.0-flash-exp (3-5x faster)\n2. Simplify your task\n3. Or split the PDF into smaller files\n\nOriginal error: ${error.message}`);
    }
    
    throw error;
  }
}

function tryParseJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}