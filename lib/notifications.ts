import { Client } from "@line/bot-sdk";
import { Medication } from "./types";
import { adminDb } from "./firebase-admin";

// --- Configuration ---
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

// Notification details
const NOTIFICATION_TITLE = "服薬リマインダー";
const NOTIFICATION_BODY = "お薬を飲む時間です";

const db = adminDb;
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
  linkedAt: Date;
}

/**
 * Sends a LINE notification to a specific user.
 */
async function sendLineNotification(
  appUserId: string,
  notificationType: "reminder" | "low_medication",
  data: any, // 通知内容に応じたデータ
): Promise<string> {
  try {
    const lineConnectionDoc = await db.collection("lineConnections").where("appUserId", "==", appUserId).limit(1).get();

    if (lineConnectionDoc.empty) {
      return `No LINE connection found for app user ${appUserId}.`;
    }

    const lineUserId = lineConnectionDoc.docs[0].id;

    let flexMessage: any;
    let altText: string;

    if (notificationType === "reminder") {
      const { title, body, sessionKey } = data;
      altText = `${title} (${sessionKey})`;
      flexMessage = {
        type: "flex",
        altText: altText,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: title,
                weight: "bold",
                size: "md",
                color: "#1DB446",
              },
              {
                type: "text",
                text: `${body} (${sessionKey})`,
                wrap: true,
                margin: "md",
              },
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "アプリで確認",
                  uri: `https://okusuri.dokkiitech.com/dashboard`
                },
                style: "link",
                margin: "md",
              }
            ],
          },
        },
      };
    } else if (notificationType === "low_medication") {
      const { medicationName, remainingDays } = data;
      altText = `【残薬通知】${medicationName}の残りが少なくなっています。`;
      flexMessage = {
        type: "flex",
        altText: altText,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "【残薬通知】",
                weight: "bold",
                size: "md",
                color: "#FF0000",
              },
              {
                type: "text",
                text: `${medicationName}の残りが少なくなっています。残り約${Math.ceil(remainingDays)}日分です。`,
                wrap: true,
                margin: "md",
              },
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "アプリで確認",
                  uri: `https://okusuri.dokkiitech.com/medications`
                },
                style: "link",
                margin: "md",
              }
            ],
          },
        },
      };
    } else {
      return `Unknown notification type: ${notificationType}`;
    }

    console.log(
      `Attempting to send LINE notification to app user ${appUserId} (LINE user: ${lineUserId}) for type ${notificationType}`,
    );
    await lineClient.pushMessage(lineUserId, flexMessage);
    console.log(`Successfully sent LINE message to app user ${appUserId} for type ${notificationType}`);
    return `LINE message sent to ${appUserId}`;
  } catch (error: any) {
    console.error(`Failed to send LINE notification to app user ${appUserId} for type ${notificationType}}:`, error.message);
    return `Error sending to ${appUserId}: ${error.message}`;
  }
}

/**
 * Checks for medications running low and sends LINE alerts.
 */
export async function checkAndSendLowMedicationAlerts() {
  console.log("Checking for low medication alerts...");
  try {
    // 残量通知が有効になっているユーザーのみを取得
    const settingsSnapshot = await db
      .collection("userSettings")
      .where("notificationSettings.lowMedicationAlerts", "==", true)
      .get();

    if (settingsSnapshot.empty) {
      console.log("No users with low medication alerts enabled found.");
      return;
    }

    const alertPromises: Promise<string>[] = [];

    for (const settingDoc of settingsSnapshot.docs) {
      const userId = settingDoc.id;
      const medicationsSnapshot = await db.collection("medications").where("userId", "==", userId).get();

      for (const medicationDoc of medicationsSnapshot.docs) {
        const medication = medicationDoc.data() as Medication;

        if (medication.remainingPills !== undefined && medication.frequency && medication.frequency.length > 0) {
          // Assuming frequency.length represents daily intake count
          const dailyIntake = medication.frequency.length * (medication.dosagePerTime || 1);
          const remainingDays = medication.remainingPills / dailyIntake;

          if (remainingDays <= 10) {
            console.log(`Low medication alert for user ${userId}: ${medication.name} has ${remainingDays} days left.`);
            const message = `【残薬通知】\n${medication.name}の残りが少なくなっています。残り約${Math.ceil(remainingDays)}日分です。`;
            alertPromises.push(sendLineNotification(userId, "low_medication", {
              medicationName: medication.name,
              remainingDays: remainingDays,
            }));
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
export async function checkAndSendReminders() {
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
      .where("notificationSettings.reminderNotifications", "==", true)
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
                sendLineNotification(appUserId, "reminder", {
                  title: NOTIFICATION_TITLE,
                  body: NOTIFICATION_BODY,
                  sessionKey: sessionKey,
                }),
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