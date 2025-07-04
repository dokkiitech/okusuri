import * as admin from "firebase-admin";
import { Client } from "@line/bot-sdk";
import { Medication } from "./lib/types";

// --- Configuration ---
const SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./path/to/your/serviceAccountKey.json";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

// Notification details
const NOTIFICATION_TITLE = "服薬リマインダー";
const NOTIFICATION_BODY = "お薬を飲む時間です";

// --- Firebase Admin SDK Initialization ---
try {
  admin.initializeApp({
    credential: admin.credential.cert(SERVICE_ACCOUNT_KEY_PATH),
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error: any) {
  console.error("Error initializing Firebase Admin SDK:", error.message);
  process.exit(1);
}

const db = admin.firestore();
const lineClient = new Client({
  channelSecret: LINE_CHANNEL_SECRET,
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
});

interface ReminderTimes {
  [sessionKey: string]: string;
}

interface UserSetting {
  notificationsEnabled?: boolean;
  reminderTimes?: ReminderTimes;
}

interface LineConnection {
  appUserId: string;
  linkedAt: admin.firestore.Timestamp;
}

/**
 * Checks for medications running low and sends LINE alerts.
 */
async function checkAndSendLowMedicationAlerts() {
  console.log("Checking for low medication alerts...");
  try {
    const usersSnapshot = await db.collection("users").get(); // Assuming users collection exists
    if (usersSnapshot.empty) {
      console.log("No users found.");
      return;
    }

    const alertPromises: Promise<string>[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const medicationsSnapshot = await db.collection("medications").where("userId", "==", userId).get();

      for (const medicationDoc of medicationsSnapshot.docs) {
        const medication = medicationDoc.data() as Medication;

        if (medication.remainingCount !== undefined && medication.frequency && medication.frequency.length > 0) {
          // Assuming frequency.length represents daily intake count
          const dailyIntake = medication.frequency.length;
          const remainingDays = medication.remainingCount / dailyIntake;

          if (remainingDays <= 10) {
            console.log(`Low medication alert for user ${userId}: ${medication.name} has ${remainingDays} days left.`);
            const message = `【残薬通知】\n${medication.name}の残りが少なくなっています。残り約${Math.ceil(remainingDays)}日分です。`;
            alertPromises.push(sendLineNotification(userId, "残薬通知", message, "low_medication"));
          }
        }
      }
    }

    if (alertPromises.length > 0) {
      const results = await Promise.all(alertPromises);
      console.log("Low medication alerts processed. Results:", results);
    } else {
      console.log("No low medication alerts to send.");
    }
  } catch (error: any) {
    console.error("Error in checkAndSendLowMedicationAlerts:", error.message, error.stack);
  }
}

/**
 * Main function to check for scheduled reminders and send notifications.
 * This function is intended to be called by a cron job or similar scheduler.
 */
async function checkAndSendReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeString = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  console.log(
    `[JST] checkAndSendReminders: Running at ${now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}. Matching against time: ${currentTimeString}`,
  );

  try {
    const settingsSnapshot = await db
      .collection("userSettings")
      .where("notificationsEnabled", "==", true)
      .get();

    if (settingsSnapshot.empty) {
      console.log("No user settings found with notificationsEnabled:true.");
      return;
    }

    const notificationPromises: Promise<string>[] = [];

    for (const userSettingDoc of settingsSnapshot.docs) {
      const settings = userSettingDoc.data() as UserSetting;
      const appUserId = userSettingDoc.id; // appUserIdはuserSettingsのドキュメントIDと仮定

      if (settings.reminderTimes && typeof settings.reminderTimes === 'object') {
        for (const sessionKey in settings.reminderTimes) {
          if (Object.prototype.hasOwnProperty.call(settings.reminderTimes, sessionKey)) {
            const reminderTimeValue = settings.reminderTimes[sessionKey];
            if (typeof reminderTimeValue === "string" && reminderTimeValue === currentTimeString) {
              console.log(
                `Match found for app user ${appUserId}, session ${sessionKey} at time ${reminderTimeValue}`,
              );
              notificationPromises.push(
                sendLineNotification(appUserId, NOTIFICATION_TITLE, NOTIFICATION_BODY, sessionKey),
              );
            }
          }
        }
      }
    }

    if (notificationPromises.length > 0) {
      const results = await Promise.all(notificationPromises);
      console.log("Notification sending attempts processed. Results:", results);
    } else {
      console.log("No matching reminders to send in this run.");
    }
  } catch (error: any) {
    console.error("Error in checkAndSendReminders:", error.message, error.stack);
  }

  // Call low medication alerts
  await checkAndSendLowMedicationAlerts();
}

/**
 * Sends a LINE notification to a specific user.
 */
async function sendLineNotification(
  appUserId: string,
  title: string,
  body: string,
  sessionKey: string,
): Promise<string> {
  try {
    // appUserIdからLINEのuserIdを取得
    const lineConnectionDoc = await db.collection("lineConnections").where("appUserId", "==", appUserId).limit(1).get();

    if (lineConnectionDoc.empty) {
      return `No LINE connection found for app user ${appUserId} (session: ${sessionKey}).`;
    }

    const lineUserId = lineConnectionDoc.docs[0].id; // lineConnectionsのドキュメントIDがLINEのuserId

    const message = `${title}\n${body} (${sessionKey})`;

    console.log(
      `Attempting to send LINE notification to app user ${appUserId} (LINE user: ${lineUserId}) for session ${sessionKey}`,
    );
    await lineClient.pushMessage(lineUserId, { type: "text", text: message });
    console.log(`Successfully sent LINE message to app user ${appUserId} for session ${sessionKey}`);
    return `LINE message sent to ${appUserId}`;
  } catch (error: any) {
    console.error(`Failed to send LINE notification to app user ${appUserId} for session ${sessionKey}}:`,
      error.message);
    return `Error sending to ${appUserId}: ${error.message}`;
  }
}

// --- Script Execution ---
if (require.main === module) {
  console.log("Starting manual run of checkAndSendReminders...");
  checkAndSendReminders()
    .then(() => {
      console.log("Manual run completed.");
    })
    .catch((error) => {
      console.error("Manual run failed:", error);
      process.exit(1);
    });
}
