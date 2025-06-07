import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore(); // Firestore instance
const messaging = admin.messaging(); // FCM instance

// Define the timezone for scheduling (e.g., Japan Standard Time)
const TIME_ZONE = "Asia/Tokyo";

/**
 * Scheduled function that runs periodically to check for and send medication reminders.
 * It checks user settings for enabled notifications and their configured reminder times.
 */
export const scheduledReminderNotification = functions
  .region("asia-northeast1") // Specify your preferred region, e.g., Tokyo
  .runWith({ memory: "128MB" }) // Optional: configure memory
  .pubsub.schedule("every 5 minutes") // Cron schedule (e.g., every 5 minutes). Adjust as needed for production.
  .timeZone(TIME_ZONE) // Set the timezone for the function's execution context
  .onRun(async (context) => {
    const now = new Date(); // This 'now' is in the TIME_ZONE specified above
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    // Format as HH:MM for comparison with Firestore data
    const currentTimeString = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

    console.log(
      `[${TIME_ZONE}] scheduledReminderNotification: Running at ${now.toISOString()}. Matching against time: ${currentTimeString}`,
    );

    try {
      // Get user settings for users who have notifications enabled
      const settingsSnapshot = await db
        .collection("userSettings")
        .where("notificationsEnabled", "==", true)
        .get();

      if (settingsSnapshot.empty) {
        console.log("No user settings found with notificationsEnabled:true.");
        return null;
      }

      const notificationPromises: Promise<string | admin.messaging.MessagingDevicesResponse>[] = [];

      settingsSnapshot.forEach((userSettingDoc) => {
        const settings = userSettingDoc.data();
        const userId = userSettingDoc.id;

        if (settings.reminderTimes && typeof settings.reminderTimes === 'object' && settings.reminderTimes !== null) {
          // Iterate over the reminder times (e.g., { 朝: "08:00", 昼: "12:30", ... })
          for (const sessionKey in settings.reminderTimes) {
            if (Object.prototype.hasOwnProperty.call(settings.reminderTimes, sessionKey)) {
              const reminderTimeValue = settings.reminderTimes[sessionKey]; // e.g., "08:00"
              if (typeof reminderTimeValue === "string" && reminderTimeValue === currentTimeString) {
                console.log(
                  `Match found for user ${userId}, session ${sessionKey} at time ${reminderTimeValue}`,
                );
                // Add the promise of sending notification to the array
                notificationPromises.push(
                  sendFcmNotification(userId, "服薬リマインダー", "お薬を飲む時間です", sessionKey),
                );
              }
            }
          }
        } else {
          console.warn(`User ${userId} has invalid or missing reminderTimes format:`, settings.reminderTimes);
        }
      });

      // Wait for all notification sending attempts to complete
      const results = await Promise.all(notificationPromises);
      console.log("Notification sending attempts processed. Results:", results.length > 0 ? results : "No matches found this run.");
      return null;
    } catch (error) {
      console.error("Error processing scheduled reminders:", error);
      return null;
    }
  });

/**
 * Helper function to send an FCM notification to a specific user.
 * @param {string} userId - The ID of the user to send the notification to.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body content of the notification.
 * @param {string} sessionKey - The medication session key (e.g., "朝", "昼") for logging.
 * @returns {Promise<string | admin.messaging.MessagingDevicesResponse>} A promise that resolves with the message ID or an error string.
 */
async function sendFcmNotification(
  userId: string,
  title: string,
  body: string,
  sessionKey: string,
): Promise<string | admin.messaging.MessagingDevicesResponse> {
  try {
    // Fetch the FCM token for the user
    const tokenDoc = await db.collection("userTokens").doc(userId).get();
    if (!tokenDoc.exists) {
      console.log(`No token document found for user ${userId} for session ${sessionKey}.`);
      return `No token document for ${userId}`;
    }

    const tokenData = tokenDoc.data();
    if (!tokenData || !tokenData.token) {
      console.log(`Token field missing or invalid for user ${userId} in document ${tokenDoc.id} for session ${sessionKey}.`);
      return `Token field missing for ${userId}`;
    }
    const userFcmToken = tokenData.token;

    // Construct the FCM message payload
    const messagePayload: admin.messaging.Message = {
      notification: {
        title: title,
        body: body,
      },
      token: userFcmToken,
      webpush: {
        notification: {
          icon: "/icon-192x192.png", // URL to the app's icon for the notification
                                     // Ensure this icon is publicly accessible or hosted appropriately.
        },
        fcmOptions: {
          link: "/", // URL to open when the notification is clicked
        },
      },
      // Example of adding data payload which can be used by the service worker
      // data: {
      //   messageType: "medicationReminder",
      //   session: sessionKey,
      //   click_action: "/", // Ensures notification click opens the app
      // }}
    };

    console.log(
      `Attempting to send notification to user ${userId} (token starts with: ${userFcmToken.substring(0, 20)}...) for session ${sessionKey}`,
    );
    const response = await messaging.send(messagePayload);
    console.log(`Successfully sent message to user ${userId} for session ${sessionKey}}:`, response);
    return response; // Message ID
  } catch (error: any) {
    console.error(`Failed to send notification to user ${userId} for session ${sessionKey}:`, error);
    // Handle specific FCM errors, e.g., unregistering invalid tokens
    if (
      error.code === "messaging/registration-token-not-registered" ||
      error.code === "messaging/invalid-registration-token"
    ) {
      console.log(`Token for user ${userId} is invalid. Deleting from Firestore.`);
      await db.collection("userTokens").doc(userId).delete().catch(delErr => {
        console.error(`Failed to delete invalid token for user ${userId}}:`, delErr);
      });
      return `Invalid token for ${userId}, deleted.`;
    }
    return `Error sending to ${userId}: ${error.message}`;
  }
}

// Note for deployment:
// 1. Ensure you have `firebase-admin` and `firebase-functions` in your functions/package.json.
// 2. Deploy using `firebase deploy --only functions`.
// 3. Check Firebase console logs for this function to ensure it's running as expected.
// 4. Adjust the cron schedule in `.pubsub.schedule()` for production needs (e.g., "every 15 minutes").
// 5. Ensure Firestore rules allow server-side (Admin SDK) access as needed, though Admin SDK typically bypasses rules.
// 6. The `webpush.notification.icon` path should be a public URL or a path relative to your app's deployed public assets.
