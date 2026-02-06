import { reminderService } from "./services/reminder.service.js";

let intervalId: ReturnType<typeof setInterval> | null = null;

/** Start the background scheduler for processing due reminders */
export function startScheduler() {
  if (intervalId) return; // Already running

  // Process due reminders every 60 seconds
  intervalId = setInterval(async () => {
    try {
      const result = await reminderService.processDueReminders();
      if (result.processed > 0) {
        console.log(`[Scheduler] Processed ${result.processed} due reminder(s)`);
      }
    } catch (error) {
      console.error("[Scheduler] Error processing reminders:", error);
    }
  }, 60_000);

  console.log("[Scheduler] Started (reminder check every 60s)");
}

/** Stop the background scheduler */
export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Scheduler] Stopped");
  }
}
