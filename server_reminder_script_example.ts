import * as admin from "firebase-admin";
// import { Timestamp } from "firebase-admin/firestore"; // If needed for more complex timestamp operations

// --- Configuration ---
// Path to your Firebase service account key JSON file
// IMPORTANT: Secure this file and ensure the path is correct for your server environment.
// You can set this via an environment variable for better security.
const SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./path/to/your/serviceAccountKey.json";

// Notification details
const NOTIFICATION_TITLE = "服薬リマインダー";
const NOTIFICATION_BODY = "お薬を飲む時間です";

// --- Firebase Admin SDK Initialization ---
try {
  admin.initializeApp({
    credential: admin.credential.cert(SERVICE_ACCOUNT_KEY_PATH),
    // databaseURL: "https://<YOUR_PROJECT_ID>.firebaseio.com" // Optional: if using Realtime Database
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error: any) {
  console.error("Error initializing Firebase Admin SDK:", error.message);
  process.exit(1); // Exit if Firebase Admin cannot be initialized
}

const db = admin.firestore();
const messaging = admin.messaging();

interface ReminderTimes {
  [sessionKey: string]: string; // e.g., { "朝": "08:00", "昼": "12:30" }
}

interface UserSetting {
  notificationsEnabled?: boolean;
  reminderTimes?: ReminderTimes;
  // other settings...
}

interface UserToken {
  token?: string;
  updatedAt?: admin.firestore.Timestamp; // To track token freshness
  // other fields...
}

/**
 * Main function to check for scheduled reminders and send notifications.
 * This function is intended to be called by a cron job or similar scheduler.
 */
async function checkAndSendReminders() {
  // Server is JST, so new Date() will be in JST
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

    const notificationPromises: Promise<string | admin.messaging.MessagingDevicesResponse>[] = [];

    settingsSnapshot.forEach((userSettingDoc: admin.firestore.QueryDocumentSnapshot) => {

      const settings = userSettingDoc.data() as UserSetting;
      const userId = userSettingDoc.id;

      if (settings.reminderTimes && typeof settings.reminderTimes === 'object') {
        for (const sessionKey in settings.reminderTimes) {
          if (Object.prototype.hasOwnProperty.call(settings.reminderTimes, sessionKey)) {
            const reminderTimeValue = settings.reminderTimes[sessionKey];
            if (typeof reminderTimeValue === "string" && reminderTimeValue === currentTimeString) {
              console.log(
                `Match found for user ${userId}, session ${sessionKey} at time ${reminderTimeValue}`,
              );
              notificationPromises.push(
                sendFcmNotification(userId, NOTIFICATION_TITLE, NOTIFICATION_BODY, sessionKey),
              );
            }
          }
        }
      } else {
        // console.warn(`User ${userId} has invalid or missing reminderTimes:`, settings.reminderTimes);
      }
    });

    if (notificationPromises.length > 0) {
      const results = await Promise.all(notificationPromises);
      console.log("Notification sending attempts processed. Results:", results);
    } else {
      console.log("No matching reminders to send in this run.");
    }
  } catch (error: any) {
    console.error("Error in checkAndSendReminders:", error.message, error.stack);
  }
}

/**
 * Sends an FCM notification to a specific user.
 */
async function sendFcmNotification(
  userId: string,
  title: string,
  body: string,
  sessionKey: string,
): Promise<string | admin.messaging.MessagingDevicesResponse> {
  try {
    const tokenDoc = await db.collection("userTokens").doc(userId).get();
    if (!tokenDoc.exists) {
      return `No token document found for user ${userId} (session: ${sessionKey}).`;
    }

    const tokenData = tokenDoc.data() as UserToken;
    if (!tokenData || !tokenData.token) {
      return `Token field missing or invalid for user ${userId} (session: ${sessionKey}).`;
    }
    const userFcmToken = tokenData.token;

    const messagePayload: admin.messaging.Message = {
      notification: { title, body },
      token: userFcmToken,
      webpush: {
        notification: {
          icon: "/icon-192x192.png", // Ensure this icon is publicly accessible from your app's domain
                                     // Or use a full URL to a hosted image.
          tag: `medication-reminder-${sessionKey}-${userId}`, // Optional: helps stack or replace notifications
        },
        fcmOptions: { link: "/" }, // URL to open on notification click
      },
      // data: { // Optional data payload for the client
      //   click_action: "/",
      //   session: sessionKey,
      // }}
    };

    console.log(
      `Attempting to send notification to user ${userId} for session ${sessionKey} (token: ${userFcmToken.substring(0,20)}...)`,
    );
    const response = await messaging.send(messagePayload);
    console.log(`Successfully sent message to user ${userId} for session ${sessionKey}: ${response}`);
    return response;
  } catch (error: any) {
    console.error(`Failed to send notification to user ${userId} for session ${sessionKey}}:`, error.code, error.message);
    if (
      error.code === "messaging/registration-token-not-registered" ||
      error.code === "messaging/invalid-registration-token"
    ) {
      console.log(`Token for user ${userId} is invalid. Deleting from Firestore.`);
      try {
        await db.collection("userTokens").doc(userId).delete();
        return `Invalid token for ${userId} deleted.`;
      } catch (deleteError: any) {
        console.error(`Failed to delete invalid token for user ${userId}}:`, deleteError.message);
        return `Failed to delete invalid token for ${userId}.`;
      }
    }
    return `Error sending to ${userId}: ${error.message}`;
  }
}

// --- Script Execution ---
// This makes the script runnable directly via `node your-script-name.js`
// For a cron job, you would typically configure the cron to call node with this script file.
if (require.main === module) {
  console.log("Starting manual run of checkAndSendReminders...");
  checkAndSendReminders()
    .then(() => {
      console.log("Manual run completed.");
      // For a script that runs once and exits, you might not need to explicitly exit
      // if there are no other pending async operations.
      // process.exit(0); // Uncomment if you need to force exit for cron.
    })
    .catch((error) => {
      console.error("Manual run failed:", error);
      process.exit(1);
    });
}

// For regular cron execution, you'd just ensure checkAndSendReminders() is called.
// The `if (require.main === module)` block is for direct execution testing.
// A cron job would simply execute `node /path/to/this/script.js` or `ts-node /path/to/this/script.ts`
// and the main logic would be whatever is callable, e.g., checkAndSendReminders().

// Example of how to make checkAndSendReminders callable for a cron:
// (No changes needed if cron just runs the file like `node script.js`)

// module.exports = { checkAndSendReminders }; // If you were to require it elsewhere.
