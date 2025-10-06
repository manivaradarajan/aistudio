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
// UI HELPERS (Unchanged)
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
  GEMINI_MODEL: 'gemini-1.5-pro-latest', // Updated to a more recent model
  API_KEY_PROPERTY: 'GEMINI_API_KEY',
  WEB_APP_URL_PROPERTY: 'WEB_APP_URL', // Store web app URL in script properties
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
// WEB APP ENDPOINT FOR IMMEDIATE ASYNC EXECUTION
// ============================================================================

/**
 * Helper function to set the web app URL in script properties.
 * Run this once after deploying the web app to enable immediate execution.
 *
 * To get your web app URL:
 * 1. Deploy > New deployment > Web app
 * 2. Copy the web app URL
 * 3. Run this function from the script editor with your URL
 */
function setWebAppUrl() {
  const url = 'PASTE_YOUR_WEB_APP_URL_HERE';
  PropertiesService.getScriptProperties().setProperty(CONFIG.WEB_APP_URL_PROPERTY, url);
  Logger.log(`Web app URL set to: ${url}`);
  Logger.log('You can now use immediate execution. Otherwise it will fall back to ~1 minute delay.');
}

/**
 * Web app GET endpoint - returns status page
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'AI Assistant Web App',
    message: 'Use POST to trigger background tasks'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Web app POST endpoint that can be called to immediately start background processing.
 * Deploy as a web app and call via UrlFetchApp to bypass UI timeout.
 */
function doPost(e) {
  try {
    const taskDetails = loadAiTask();
    if (!taskDetails) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No task details found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Process immediately (within 6-minute limit)
    const doc = DocumentApp.openById(taskDetails.docId);
    const { config, uploadedFiles } = taskDetails;

    const contextHistory = config.useContext ? loadContext(doc) : [];
    const promptData = buildPrompt(config, uploadedFiles);
    const response = callGeminiApi(promptData, contextHistory, config.useContext, config.geminiModel);

    if (config.useContext) {
      saveContext(doc, promptData.textPrompt, response);
    }

    writeOutput(doc, response, config.useContext);
    deleteAiTask();

    return ContentService.createTextOutput(JSON.stringify({
      success: true
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(`doPost error: ${error.stack}`);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// ADD-ON UI (Unchanged)
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
// UPLOAD FILES WORKFLOW (Unchanged)
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
// RUN AI TASK WORKFLOW (*** MODIFIED FOR ASYNC EXECUTION ***)
// ============================================================================

/**
 * Initiates the AI task. This function is called by the UI.
 * It runs the task directly but returns immediately with status.
 */
function runAiTask() {
  const doc = DocumentApp.getActiveDocument();
  try {
    const config = readConfiguration(doc);
    if (!config.systemPrompt && !config.task) {
      return showError('Provide at least a System Prompt or a Task to process.');
    }

    // Ensure necessary tabs exist
    ensureTab(doc, CONFIG.TABS.OUTPUT);
    ensureTab(doc, CONFIG.TABS.CONTEXT_HISTORY);

    // Write a "processing" message immediately
    writeOutput(doc, '[Processing...] Task started at ' + new Date().toLocaleString(), config.useContext);

    // Package task details for async execution
    const taskDetails = {
      config: config,
      uploadedFiles: loadUploadedFiles(doc),
      docId: doc.getId()
    };

    // Save task for async processing
    saveAiTask(taskDetails);

    // Try to use web app for immediate execution
    const webAppUrl = PropertiesService.getScriptProperties().getProperty(CONFIG.WEB_APP_URL_PROPERTY);

    if (webAppUrl) {
      try {
        // Call web app asynchronously (fire and forget)
        UrlFetchApp.fetch(webAppUrl, {
          method: 'post',
          payload: JSON.stringify({trigger: 'aiTask'}),
          contentType: 'application/json',
          muteHttpExceptions: true
        });

        return CardService.newActionResponseBuilder()
            .setNotification(CardService.newNotification()
                .setText('Task started. Check the AI Output tab for results.'))
            .build();
      } catch (webAppError) {
        Logger.log(`Web app call failed: ${webAppError.message}, falling back to trigger`);
      }
    }

    // Fallback to trigger-based approach (has ~1 minute delay)
    const trigger = ScriptApp.newTrigger('processAiTaskInBackground')
      .timeBased()
      .after(1)
      .create();

    Logger.log(`Created fallback trigger: ${trigger.getUniqueId()}`);

    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
            .setText('Task queued. Results in ~1 minute in the AI Output tab.'))
        .build();

  } catch (error) {
    Logger.log(error.stack);
    return showError(`Failed to start AI task: ${error.message}`);
  }
}

/**
 * Processes the AI task in the background. This function is called by a trigger
 * and has a 6-minute execution limit.
 * @param {Object} e The event object from the trigger.
 */
function processAiTaskInBackground(e) {
  // Always delete the trigger that called this function to prevent re-runs
  if (e && e.triggerUid) {
    const allTriggers = ScriptApp.getProjectTriggers();
    for (const trigger of allTriggers) {
      if (trigger.getUniqueId() === e.triggerUid) {
        ScriptApp.deleteTrigger(trigger);
        break;
      }
    }
  }

  const taskDetails = loadAiTask();
  if (!taskDetails) {
    Logger.log('Background process triggered but no task details were found.');
    return;
  }
  
  // Re-open the document using the stored ID
  const doc = DocumentApp.openById(taskDetails.docId);
  const { config, uploadedFiles } = taskDetails;

  try {
    Logger.log('Starting background AI task processing...');
    
    const contextHistory = config.useContext ? loadContext(doc) : [];
    Logger.log(`Loaded ${contextHistory.length / 2} previous turn(s)`);

    Logger.log(`Calling Gemini API (${config.geminiModel})...`);
    const promptData = buildPrompt(config, uploadedFiles);
    const response = callGeminiApi(promptData, contextHistory, config.useContext, config.geminiModel);
    Logger.log(`Received response (${response.length} chars)`);

    if (config.useContext) {
      saveContext(doc, promptData.textPrompt, response);
      Logger.log('Context saved');
    }
    
    writeOutput(doc, response, config.useContext);
    Logger.log('Output written to AI Output tab');

  } catch (error) {
    Logger.log(`Background task failed: ${error.stack}`);
    // Write the error to the output tab for user visibility
    const errorMessage = `[BACKGROUND TASK FAILED]\n\nTimestamp: ${new Date().toLocaleString()}\n\nError: ${error.message}`;
    writeOutput(doc, errorMessage, false);
  } finally {
    // IMPORTANT: Clean up the stored task details
    deleteAiTask();
    Logger.log('Cleaned up pending AI task properties.');
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
// GEMINI FILE UPLOAD (Unchanged)
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
// UPLOADED FILES STORAGE (Unchanged)
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
// CONFIGURATION & TAB OPERATIONS (Unchanged)
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
  
  if (body.getNumChildren() > 0 && body.getText().trim() !== '') {
    body.appendParagraph('').appendHorizontalRule();
  }
  
  const header = isContextual ? `${timestamp} (with context)` : timestamp;
  body.appendParagraph(header).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(content || 'No content returned.');
}

// ============================================================================
// CONTEXT MANAGEMENT (Unchanged)
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
// PROMPT BUILDING (Unchanged)
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
// GEMINI API CALL
// ============================================================================

/**
 * Calls the Gemini API with the constructed prompt and optional conversation history.
 * @param {object} promptData The prompt data containing parts array and text prompt
 * @param {array} contextHistory Previous conversation turns (empty array if no context)
 * @param {boolean} useContext Whether to include context in the API call
 * @param {string} geminiModel The Gemini model to use
 * @returns {string} The model's response text
 */
function callGeminiApi(promptData, contextHistory, useContext, geminiModel) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(CONFIG.API_KEY_PROPERTY);
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in Script Properties');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  // Build the contents array
  const contents = [];

  // Add context history if using context
  if (useContext && contextHistory && contextHistory.length > 0) {
    contents.push(...contextHistory);
  }

  // Add the current user prompt
  contents.push({
    role: 'user',
    parts: promptData.parts
  });

  const payload = {
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      Logger.log(`Gemini API error: ${responseText}`);
      throw new Error(`Gemini API returned ${responseCode}: ${responseText}`);
    }

    const result = JSON.parse(responseText);

    // Extract text from response
    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        return candidate.content.parts.map(part => part.text || '').join('');
      }
    }

    throw new Error('No valid response from Gemini API');

  } catch (error) {
    Logger.log(`Gemini API call failed: ${error.message}`);
    throw error;
  }
}