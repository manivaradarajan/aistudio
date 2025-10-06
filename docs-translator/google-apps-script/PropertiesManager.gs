/**
 * @fileoverview Manages storing and retrieving AI task data using PropertiesService.
 * This allows tasks to be passed from a short-lived UI function to a long-running
 * background trigger.
 */

const PENDING_AI_TASK_KEY = 'pendingAiTask';

/**
 * Saves the details of an AI task to user properties for background processing.
 * @param {object} taskDetails The task configuration object to save.
 */
function saveAiTask(taskDetails) {
  try {
    const properties = PropertiesService.getUserProperties();
    properties.setProperty(PENDING_AI_TASK_KEY, JSON.stringify(taskDetails));
  } catch (e) {
    Logger.log(`Error saving AI task details: ${e.message}`);
    throw new Error('Could not save the task for background processing.');
  }
}

/**
 * Loads the pending AI task details from user properties.
 * @returns {object|null} The parsed task details object, or null if none is found.
 */
function loadAiTask() {
  try {
    const properties = PropertiesService.getUserProperties();
    const taskDetailsJson = properties.getProperty(PENDING_AI_TASK_KEY);
    if (!taskDetailsJson) {
      return null;
    }
    return JSON.parse(taskDetailsJson);
  } catch (e) {
    Logger.log(`Error loading AI task details: ${e.message}`);
    // If parsing fails, delete the corrupted property
    deleteAiTask();
    return null;
  }
}

/**
 * Deletes the pending AI task details from user properties after processing.
 */
function deleteAiTask() {
  try {
    const properties = PropertiesService.getUserProperties();
    properties.deleteProperty(PENDING_AI_TASK_KEY);
  } catch (e) {
    Logger.log(`Error deleting AI task details: ${e.message}`);
  }
}