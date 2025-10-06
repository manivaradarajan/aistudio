/**
 * AI Assistant for Google Docs with Context Persistence - Add-on Version
 * 
 * REQUIRED TABS (all optional except one must have content):
 * - System Prompt: AI instructions
 * - Task: What you want done
 * - Parameters: Configuration (USE_CONTEXT: true/false)
 * - Input: File IDs and URLs (format: file:ID, folder:ID, url:URL, or https://...)
 * - Uploaded Files: File URIs from Gemini (auto-created)
 * - AI Output: Where responses are written (auto-created)
 * - Context History: Conversation state (auto-created)
 */

// ============================================================================
// UI HELPERS
// ============================================================================

function showError(message) {
  const errorCard = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Error'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText(message.replace(/\n/g, '<br>')))
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

function closeErrorCard() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

function showLogs(logs, success) {
  const logText = logs.join('\n');
  
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(success ? 'Success' : 'Execution Log'))
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

function showLogsWithError(logs, errorMessage) {
  const logText = logs.join('\n');
  const fullText = `${logText}\n\n${'='.repeat(50)}\nFULL ERROR:\n${errorMessage}`;
  
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Error'))
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

const CONFIG = {
  TABS: {
    SYSTEM_PROMPT: 'System Prompt',
    TASK: 'Task',
    PARAMETERS: 'Parameters',
    INPUT: 'Input',
    UPLOADED_FILES: 'Uploaded Files',
    OUTPUT: 'AI Output',
    CONTEXT_HISTORY: 'Context History'
  },
  GEMINI_MODEL: 'gemini-2.0-pro',
  API_KEY_PROPERTY: 'GEMINI_API_KEY',
  MAX_FILE_SIZE: 50000,
  MAX_CONTEXT_TURNS: 10,
  SUPPORTED_MIME_TYPES: {
    'image/png': true, 'image/jpeg': true, 'image/webp': true,
    'image/heic': true, 'image/heif': true,
    'video/mp4': true, 'video/mpeg': true, 'video/quicktime': true,
    'video/x-msvideo': true, 'video/webm': true, 'video/3gpp': true,
    'audio/wav': true, 'audio/mp3': true, 'audio/aiff': true,
    'audio/aac': true, 'audio/ogg': true, 'audio/flac': true,
    'application/pdf': true, 'text/plain': true, 'text/html': true,
    'text/css': true, 'text/javascript': true, 'text/csv': true,
    'text/markdown': true, 'application/json': true, 'text/xml': true,
    'application/rtf': true, 'text/rtf': true,
    'text/x-python': true, 'application/x-python-code': true,
    'text/x-typescript': true, 'application/x-typescript': true,
    'application/x-javascript': true
  }
};

// ============================================================================
// ADD-ON UI
// ============================================================================

function onDocsHomepage(e) {
  const builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle('AI Assistant'));

  const section = CardService.newCardSection();
  
  section.addWidget(CardService.newTextParagraph()
    .setText('Upload files to Gemini once, then run AI tasks using those files.')
  );
  
  section.addWidget(CardService.newButtonSet()
    .addButton(CardService.newTextButton()
      .setText('Upload Files')
      .setOnClickAction(CardService.newAction().setFunctionName('uploadFiles')))
    .addButton(CardService.newTextButton()
      .setText('Run AI Task')
      .setOnClickAction(CardService.newAction().setFunctionName('runAiTask')))
  );

  section.addWidget(CardService.newButtonSet()
    .addButton(CardService.newTextButton()
      .setText('Clear Context')
      .setOnClickAction(CardService.newAction().setFunctionName('clearContextHistory')))
    .addButton(CardService.newTextButton()
      .setText('Clear Uploads')
      .setOnClickAction(CardService.newAction().setFunctionName('clearUploadedFiles')))
  );

  builder.addSection(section);
  return builder.build();
}

// ============================================================================
// UPLOAD FILES WORKFLOW
// ============================================================================

function uploadFiles() {
  const doc = DocumentApp.getActiveDocument();
  const logs = [];
  
  try {
    logs.push('Reading Input tab...');
    const inputText = readTabOptional(doc, CONFIG.TABS.INPUT);
    const inputs = parseInputs(inputText);
    
    if (inputs.length === 0) {
      return showError('No inputs found in Input tab. Add file IDs, folder IDs, or URLs.');
    }
    
    logs.push(`Found ${inputs.length} input(s) to process`);
    
    ensureTab(doc, CONFIG.TABS.UPLOADED_FILES);
    
    logs.push('\nUploading files to Gemini...');
    const uploadedFiles = [];
    
    inputs.forEach((source, idx) => {
      logs.push(`\n[${idx + 1}/${inputs.length}] Processing ${source.type}: ${source.value.substring(0, 50)}...`);
      
      try {
        if (source.type === 'file') {
          const result = uploadSingleFile(source.value);
          uploadedFiles.push(result);
          logs.push(`  ✓ Uploaded: ${result.name}`);
        } else if (source.type === 'folder') {
          const results = uploadFolder(source.value);
          uploadedFiles.push(...results);
          logs.push(`  ✓ Uploaded ${results.length} file(s) from folder`);
        } else if (source.type === 'url') {
          const result = fetchAndUploadUrl(source.value);
          uploadedFiles.push(result);
          logs.push(`  ✓ Fetched and uploaded URL`);
        }
      } catch (error) {
        logs.push(`  ❌ ERROR: ${error.message}`);
        throw new Error(`Failed to process input [${idx + 1}]: ${error.message}`);
      }
    });
    
    logs.push(`\n✓ Successfully uploaded ${uploadedFiles.length} file(s)`);
    
    // Save uploaded file URIs
    saveUploadedFiles(doc, uploadedFiles);
    logs.push('✓ Saved file URIs to Uploaded Files tab');
    
    return showLogs(logs, true);
    
  } catch (error) {
    Logger.log(error.stack);
    logs.push(`\n❌ ERROR: ${error.message}`);
    return showLogsWithError(logs, error.message);
  }
}

// ============================================================================
// RUN AI TASK WORKFLOW
// ============================================================================

function runAiTask() {
  const doc = DocumentApp.getActiveDocument();
  const logs = [];
  
  try {
    logs.push('Reading configuration...');
    const config = readConfiguration(doc);
    logs.push(`✓ System Prompt: ${config.systemPrompt ? 'Yes' : 'No'}`);
    logs.push(`✓ Task: ${config.task ? 'Yes' : 'No'}`);
    logs.push(`✓ Context enabled: ${config.useContext}`);
    
    if (!config.systemPrompt && !config.task) {
      return showError('Provide at least System Prompt or Task to process.');
    }

    logs.push('\nSetting up tabs...');
    ensureTab(doc, CONFIG.TABS.OUTPUT);
    ensureTab(doc, CONFIG.TABS.CONTEXT_HISTORY);
    logs.push('✓ Tabs ready');

    // Load uploaded files
    logs.push('\nLoading uploaded files...');
    const uploadedFiles = loadUploadedFiles(doc);
    logs.push(`✓ Found ${uploadedFiles.length} uploaded file(s)`);

    // Load context if needed
    if (config.useContext) {
      logs.push('\nLoading conversation context...');
      const history = loadContext(doc);
      logs.push(`✓ Loaded ${history.length / 2} previous turn(s)`);
      var contextHistory = history;
    } else {
      var contextHistory = [];
    }
    
    // Build and send prompt
    logs.push(`\nCalling Gemini API (${config.geminiModel})...`);
    
    const promptData = buildPrompt(config, uploadedFiles);
    const response = callGeminiApi(promptData, contextHistory, config.useContext, config.geminiModel);
    logs.push(`✓ Received response (${response.length} chars)`);

    // Save context and output
    if (config.useContext) {
      logs.push('\nSaving context...');
      saveContext(doc, promptData.textPrompt, response);
      logs.push('✓ Context saved');
    }
    
    logs.push('\nWriting output...');
    writeOutput(doc, response, config.useContext);
    logs.push('✓ Output written to AI Output tab');
    
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
            .setText('Context history cleared.'))
        .build();
  } catch (error) {
    return showError(error.message);
  }
}

function clearUploadedFiles() {
  try {
    const doc = DocumentApp.getActiveDocument();
    const tab = doc.getTabs().find(t => t.getTitle() === CONFIG.TABS.UPLOADED_FILES);
    if (tab) {
      const body = tab.asDocumentTab().getBody();
      body.clear();
      body.appendParagraph('Uploaded Files').setHeading(DocumentApp.ParagraphHeading.TITLE);
      body.appendParagraph('Files uploaded to Gemini (valid for 48 hours).');
    }
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
            .setText('Uploaded files cleared.'))
        .build();
  } catch (error) {
    return showError(error.message);
  }
}

// ============================================================================
// GEMINI FILE UPLOAD
// ============================================================================

function uploadSingleFile(fileId) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(CONFIG.API_KEY_PROPERTY);
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  
  try {
    // Get file metadata
    const token = ScriptApp.getOAuthToken();
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`;
    const metadataResponse = UrlFetchApp.fetch(metadataUrl, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    if (metadataResponse.getResponseCode() !== 200) {
      throw new Error(`Cannot access file ${fileId}`);
    }
    
    const metadata = JSON.parse(metadataResponse.getContentText());
    const fileName = metadata.name;
    const mimeType = metadata.mimeType;
    const fileSize = parseInt(metadata.size || '0');
    
    Logger.log(`Processing: ${fileName}, Type: ${mimeType}, Size: ${fileSize}`);
    
    // Handle Google Workspace files
    if (mimeType === MimeType.GOOGLE_DOCS) {
      const content = DocumentApp.openById(fileId).getBody().getText();
      return {name: fileName, content, mimeType: 'text/plain', isText: true};
    }
    
    if (mimeType === MimeType.GOOGLE_SHEETS) {
      const sheet = SpreadsheetApp.openById(fileId);
      let content = '';
      sheet.getSheets().forEach(s => {
        content += `Sheet: ${s.getName()}\n`;
        content += s.getDataRange().getValues().map(row => row.join('\t')).join('\n') + '\n\n';
      });
      return {name: fileName, content, mimeType: 'text/plain', isText: true};
    }
    
    if (mimeType === MimeType.GOOGLE_SLIDES) {
      const pres = SlidesApp.openById(fileId);
      let content = `Presentation: ${pres.getName()}\n\n`;
      pres.getSlides().forEach((slide, i) => {
        content += `Slide ${i + 1}:\n`;
        slide.getPageElements().forEach(el => {
          try {
            const shape = el.asShape();
            if (shape && shape.getText()) content += shape.getText().asString() + '\n';
          } catch (e) {}
        });
        content += '\n';
      });
      return {name: fileName, content, mimeType: 'text/plain', isText: true};
    }
    
    if (!CONFIG.SUPPORTED_MIME_TYPES[mimeType]) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
    
    // For small text files, inline them
    if ((mimeType.startsWith('text/') || mimeType.includes('json')) && fileSize < 1000000) {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const downloadResponse = UrlFetchApp.fetch(downloadUrl, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      });
      return {name: fileName, content: downloadResponse.getContentText(), mimeType, isText: true};
    }
    
    // For PDFs and large files: Upload to Gemini
    Logger.log(`Uploading ${fileName} to Gemini...`);
    
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const downloadResponse = UrlFetchApp.fetch(downloadUrl, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    if (downloadResponse.getResponseCode() !== 200) {
      throw new Error(`Drive download failed`);
    }
    
    const fileBytes = downloadResponse.getContent();
    Logger.log(`Downloaded ${fileBytes.length} bytes`);
    
    // Start resumable upload
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    
    const uploadMetadata = {
      file: {
        display_name: fileName
      }
    };
    
    const initResponse = UrlFetchApp.fetch(uploadUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': fileBytes.length.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType
      },
      payload: JSON.stringify(uploadMetadata),
      muteHttpExceptions: true
    });
    
    if (initResponse.getResponseCode() !== 200) {
      throw new Error(`Upload init failed: ${initResponse.getContentText()}`);
    }
    
    const headers = initResponse.getHeaders();
    const uploadUri = headers['x-goog-upload-url'] || headers['X-Goog-Upload-URL'];
    
    if (!uploadUri) {
      throw new Error('No upload URL returned');
    }
    
    // Upload file content
    const uploadFileResponse = UrlFetchApp.fetch(uploadUri, {
      method: 'put',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize'
      },
      payload: fileBytes,
      muteHttpExceptions: true
    });
    
    if (uploadFileResponse.getResponseCode() !== 200) {
      throw new Error(`File upload failed: ${uploadFileResponse.getContentText()}`);
    }
    
    const result = JSON.parse(uploadFileResponse.getContentText());
    const fileUri = result.file.uri;
    const uploadedFileName = result.file.name;
    
    Logger.log(`✓ Uploaded: ${fileUri}`);
    
    // Wait for processing if needed
    if (mimeType === 'application/pdf' || mimeType.startsWith('video/')) {
      let attempts = 0;
      let isReady = false;
      
      while (attempts < 10 && !isReady) {
        Utilities.sleep(3000);
        attempts++;
        
        const statusUrl = `https://generativelanguage.googleapis.com/v1beta/${uploadedFileName}?key=${apiKey}`;
        const statusResponse = UrlFetchApp.fetch(statusUrl, {muteHttpExceptions: true});
        
        if (statusResponse.getResponseCode() === 200) {
          const status = JSON.parse(statusResponse.getContentText());
          
          if (status.state === 'ACTIVE') {
            isReady = true;
          } else if (status.state === 'FAILED') {
            throw new Error('File processing failed');
          }
        }
      }
    }
    
    return {
      name: fileName,
      mimeType: mimeType,
      fileUri: fileUri,
      isGeminiFile: true
    };
    
  } catch (error) {
    Logger.log(`Upload error: ${error.message}`);
    throw error;
  }
}

function uploadFolder(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const results = [];
  const files = folder.getFiles();
  
  while (files.hasNext()) {
    try {
      results.push(uploadSingleFile(files.next().getId()));
    } catch (e) {
      Logger.log(`Skipping file: ${e.message}`);
    }
  }
  
  return results;
}

function fetchAndUploadUrl(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`HTTP ${response.getResponseCode()}`);
  }
  
  const contentType = response.getHeaders()['Content-Type'] || 'text/html';
  let mimeType = 'text/html';
  if (contentType.includes('text/plain')) mimeType = 'text/plain';
  else if (contentType.includes('application/json')) mimeType = 'application/json';
  
  return {name: url, content: response.getContentText(), mimeType, isText: true};
}

// ============================================================================
// UPLOADED FILES STORAGE
// ============================================================================

function saveUploadedFiles(doc, files) {
  ensureTab(doc, CONFIG.TABS.UPLOADED_FILES);
  const tab = doc.getTabs().find(t => t.getTitle() === CONFIG.TABS.UPLOADED_FILES);
  const body = tab.asDocumentTab().getBody();
  body.clear();
  
  body.appendParagraph('Uploaded Files').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(`Uploaded: ${new Date().toLocaleString()}`);
  body.appendParagraph(`Files: ${files.length}`);
  body.appendParagraph('Valid for 48 hours from upload time.');
  body.appendParagraph('--- FILE DATA ---');
  body.appendParagraph(JSON.stringify(files, null, 2));
}

function loadUploadedFiles(doc) {
  try {
    const tab = doc.getTabs().find(t => t.getTitle() === CONFIG.TABS.UPLOADED_FILES);
    if (!tab) return [];
    
    const text = tab.asDocumentTab().getBody().getText();
    const markerIndex = text.indexOf('--- FILE DATA ---');
    if (markerIndex === -1) return [];
    
    const jsonStr = text.substring(markerIndex + 17).trim();
    if (!jsonStr) return [];
    
    return JSON.parse(jsonStr);
  } catch (error) {
    Logger.log(`Failed to load uploaded files: ${error.message}`);
    return [];
  }
}

// ============================================================================
// CONFIGURATION & TAB OPERATIONS
// ============================================================================

function readConfiguration(doc) {
  const params = parseParameters(readTabOptional(doc, CONFIG.TABS.PARAMETERS));
  
  return {
    systemPrompt: readTabOptional(doc, CONFIG.TABS.SYSTEM_PROMPT),
    task: readTabOptional(doc, CONFIG.TABS.TASK),
    params: params,
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
      
      if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/[-\w]{25,}/);
        if (fileIdMatch) {
          inputs.push({type: 'file', value: fileIdMatch[0]});
          return;
        }
      }
      
      inputs.push({type: 'url', value: url});
    }
  });
  
  return inputs;
}

function readTabOptional(doc, tabName) {
  try {
    const tab = doc.getTabs().find(t => t.getTitle() === tabName);
    return tab ? tab.asDocumentTab().getBody().getText().trim() : '';
  } catch (error) {
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
    } else if (tabName === CONFIG.TABS.UPLOADED_FILES) {
      body.appendParagraph('Files uploaded to Gemini (valid for 48 hours).');
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
// PROMPT BUILDING
// ============================================================================

function buildPrompt(config, uploadedFiles) {
  let text = '';
  
  if (config.systemPrompt) text += `System Prompt: ${config.systemPrompt}\n\n`;
  if (config.task) text += `Task: ${config.task}\n\n`;
  
  const relevantParams = Object.entries(config.params).filter(([k]) => k !== 'USE_CONTEXT' && k !== 'GEMINI_MODEL');
  if (relevantParams.length > 0) {
    text += 'Parameters:\n';
    relevantParams.forEach(([k, v]) => text += `- ${k}: ${v}\n`);
    text += '\n';
  }
  
  if (uploadedFiles.length > 0) {
    text += `Processing ${uploadedFiles.length} file(s):\n\n`;
  }
  
  const parts = text ? [{text}] : [];
  
  uploadedFiles.forEach(file => {
    if (file.isGeminiFile) {
      parts.push({text: `\n--- FILE: ${file.name} ---\n`});
      parts.push({
        fileData: {
          fileUri: file.fileUri,
          mimeType: file.mimeType
        }
      });
    } else if (file.isText) {
      const content = file.content.length > CONFIG.MAX_FILE_SIZE
        ? file.content.substring(0, CONFIG.MAX_FILE_SIZE) + '\n[truncated]'
        : file.content;
      parts.push({text: `\n--- FILE: ${file.name} ---\n${content}\n--- END ---\n`});
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
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in script properties');

  const model = modelName || CONFIG.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const contents = useContext && history.length > 0 ? [...history] : [];
  contents.push({role: 'user', parts: promptData.parts});
  
  Logger.log(`Calling Gemini API with model: ${model}`);
  Logger.log(`Request size: ${JSON.stringify(contents).length} chars`);
  Logger.log(`Number of parts: ${promptData.parts.length}`);
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({contents}),
      muteHttpExceptions: true
    });
    
    const elapsed = (Date.now() - startTime) / 1000;
    Logger.log(`API responded in ${elapsed.toFixed(1)}s`);
    
    const code = response.getResponseCode();
    const body = response.getContentText();
    
    Logger.log(`Response code: ${code}`);
    Logger.log(`Response body length: ${body.length}`);
    
    if (code === 429) throw new Error('Rate limit exceeded');
    if (code === 403) throw new Error('Invalid API key');
    if (code === 400) {
      Logger.log(`Full 400 error: ${body}`);
      throw new Error(`Bad request: ${body.substring(0, 500)}`);
    }
    if (code !== 200) {
      Logger.log(`Full error response: ${body}`);
      throw new Error(`API error ${code}: ${body.substring(0, 500)}`);
    }
    
    const json = JSON.parse(body);
    if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
      const resultText = json.candidates[0].content.parts[0].text;
      Logger.log(`Got response text: ${resultText.length} chars`);
      return resultText;
    }
    
    const reason = json.candidates?.[0]?.finishReason || 'Unknown';
    Logger.log(`Response blocked or empty. Reason: ${reason}, Full JSON: ${JSON.stringify(json)}`);
    return `Response blocked. Reason: ${reason}`;
    
  } catch (error) {
    const elapsed = (Date.now() - startTime) / 1000;
    Logger.log(`Error after ${elapsed.toFixed(1)}s: ${error.message}`);
    Logger.log(`Error stack: ${error.stack}`);
    throw error;
  }
}

// ============================================================================
//