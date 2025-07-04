import cron from "node-cron";
import { checkAndSendReminders, checkAndSendLowMedicationAlerts } from "./notifications";

let isSchedulerInitialized = false;

export const initScheduler = () => {
  if (isSchedulerInitialized) {
    console.log("Scheduler already initialized. Skipping.");
    return;
  }

  console.log("Initializing scheduler...");

  // 毎分実行するcronジョブ
  // 実際の運用では、負荷を考慮して適切な間隔を設定してください。
  // 例: 毎時0分に実行: "0 * * * *"
  // 例: 毎日午前8時0分に実行: "0 8 * * *"
  cron.schedule("* * * * *", async () => {
    console.log("Running scheduled task: checkAndSendReminders");
    try {
      await checkAndSendReminders();
    } catch (error) {
      console.error("Error in scheduled checkAndSendReminders:", error);
    }
  });

  // 残薬通知は、服薬リマインダーの一部としてcheckAndSendReminders内で呼び出されるため、
  // ここで別途スケジュールする必要はありません。

  isSchedulerInitialized = true;
  console.log("Scheduler initialized successfully.");
};
