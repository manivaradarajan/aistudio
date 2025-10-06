/**
 * Simplified Apps Script - Just calls Cloud Run endpoint
 * All heavy processing happens in Python
 */

// Configuration
const CLOUD_RUN_URL = 'YOUR_CLOUD_RUN_URL_HERE'; // Update after deployment

// ============================================================================
// ADD-ON UI
// ============================================================================

function onDocsHomepage(e) {
  const builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle('AI Assistant'));

  const section = CardService.newCardSection();

  section.addWidget(CardService.newTextParagraph()
    .setText('Process this document with AI using Gemini.')
  );

  section.addWidget(CardService.newButtonSet()
    .addButton(CardService.newTextButton()
      .setText('Process with AI')
      .setOnClickAction(CardService.newAction().setFunctionName('processWithCloudRun')))
  );

  builder.addSection(section);
  return builder.build();
}

// ============================================================================
// CLOUD RUN INTEGRATION
// ============================================================================

function processWithCloudRun() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();

  try {
    // Call Cloud Run endpoint
    const url = `${CLOUD_RUN_URL}/process/${docId}`;

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 401) {
      // Need authentication
      const data = JSON.parse(responseText);
      return showAuthRequired(data.auth_url);
    }

    if (responseCode === 200) {
      return CardService.newActionResponseBuilder()
          .setNotification(CardService.newNotification()
              .setText('✓ Task completed! Check the AI Output tab.'))
          .build();
    }

    // Error occurred
    return showError(`Error: ${responseText}`);

  } catch (error) {
    Logger.log(error.stack);
    return showError(`Failed to call Cloud Run: ${error.message}`);
  }
}

function showAuthRequired(authUrl) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Authentication Required'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('You need to authorize access to your Google Docs.'))
      .addWidget(CardService.newTextInput()
        .setFieldName('auth_url')
        .setValue(authUrl)
        .setTitle('Copy this URL and open in browser:'))
      .addWidget(CardService.newButtonSet()
        .addButton(CardService.newTextButton()
          .setText('Close')
          .setOnClickAction(CardService.newAction()
            .setFunctionName('closeCard')))))
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

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
            .setFunctionName('closeCard')))))
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(errorCard))
    .build();
}

function closeCard() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}
