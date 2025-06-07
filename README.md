# Medication Management Application

## 1. Project Overview

This is a medication management application designed to help users track their medications, schedules, and adherence. Key features include medication logging, scheduling, reminders (via push notifications), and parental control for managing dependents' medication.

The application consists of a Next.js frontend and an optional server-side script for sending scheduled push notification reminders.

## 2. Next.js Application (Frontend)

### Prerequisites
- Node.js (latest LTS version recommended)
- pnpm (or npm/yarn)

### Environment Variables
Create a `.env.local` file in the root of the Next.js application directory. This file will store your Firebase client-side configuration.

**Essential Firebase Variables:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# This VAPID key is crucial for Web Push Notifications (Firebase Cloud Messaging)
# Generate this in your Firebase project settings: Project settings > Cloud Messaging > Web configuration > Web Push certificates
NEXT_PUBLIC_FIREBASE_VAPID_KEY="YOUR_VAPID_KEY"
```
Replace `"YOUR_..."` with your actual Firebase project credentials.

### Development
1.  **Install dependencies:**
    ```bash
    pnpm install
    # Or: npm install
    ```
2.  **Run the development server:**
    ```bash
    pnpm dev
    # Or: npm run dev
    ```
    The application will typically be available at `http://localhost:3000`.

### Production Build & Run
1.  **Build the application:**
    ```bash
    pnpm build
    # Or: npm run build
    ```
2.  **Start the production server:**
    ```bash
    pnpm start
    # Or: npm run start
    ```

### Deployment with PM2 (Optional for Production Servers)
For managing the Next.js production process on a server, PM2 is a recommended process manager.
```bash
# Example: Start the app using pnpm's start script
pm2 start pnpm --name "medication-app" -- run start

# Or, create an ecosystem.config.js file for more complex configurations:
# module.exports = {
#   apps : [{
#     name   : "medication-app",
#     script : "pnpm",
#     args   : "start",
#     env_production: {
#       NODE_ENV: "production"
#     }
#   }]
# }
# pm2 start ecosystem.config.js --env production
```

## 3. Server-Side Reminder Script (`server_reminder_script_example.ts`)

### Purpose
This script sends scheduled push notifications for medication reminders. It uses `firebase-admin` to interact with Firestore and FCM. **This script is designed to run on a user-managed server (e.g., a VPS, dedicated server, or a Raspberry Pi) and is separate from the Next.js application hosting (like Vercel).** Vercel serverless functions have execution time limits that might not be suitable for a continuously running cron-like job, and this script provides an alternative for users who manage their own servers.

### Prerequisites (on the server)
- Node.js (latest LTS version recommended)
- npm or pnpm
- A Firebase Service Account Key JSON file for your project.

### Setup Steps

1.  **Place Script & Service Account Key:**
    -   Copy `server_reminder_script_example.ts` (from the repository root) to a directory on your server (e.g., `/opt/medication-reminder/`).
    -   Download your Firebase service account key JSON file from your Firebase Project Settings (`Project settings > Service accounts > Generate new private key`).
    -   Place this key file (e.g., `your-service-account-key.json`) in the same directory.
    -   **IMPORTANT: Secure this service account key file. Set appropriate file permissions (e.g., `chmod 600 your-service-account-key.json`) and ensure it's not publicly accessible.**

2.  **Install Dependencies:**
    -   Navigate to the directory where you placed the script (e.g., `/opt/medication-reminder/`):
        ```bash
        cd /opt/medication-reminder/
        ```
    -   Initialize a `package.json` and install necessary dependencies:
        ```bash
        npm init -y
        npm install firebase-admin typescript ts-node
        # Or, if you prefer to compile to JavaScript first and run with node:
        # npm install firebase-admin typescript
        ```

3.  **Configure Service Account Key Path:**
    -   The script uses the `GOOGLE_APPLICATION_CREDENTIALS` environment variable by default.
    -   Set this variable to the full path of your service account key JSON file. Add this line to your shell's profile (e.g., `~/.bashrc`, `~/.zshrc`) or set it directly in your cron job line.
        ```bash
        export GOOGLE_APPLICATION_CREDENTIALS="/opt/medication-reminder/your-service-account-key.json"
        ```
        (Remember to `source ~/.bashrc` or log out/in for the change to take effect in new sessions).
    -   Alternatively (less secure, not recommended for production), you can modify the `SERVICE_ACCOUNT_KEY_PATH` variable directly in `server_reminder_script_example.ts`.

4.  **Manual Test Run:**
    -   Before setting up a cron job, test the script manually:
    -   **Using ts-node (recommended for development/testing):**
        ```bash
        # Ensure GOOGLE_APPLICATION_CREDENTIALS is set in your current session
        npx ts-node server_reminder_script_example.ts
        ```
    -   **Compile to JavaScript then run (for production or if ts-node is not preferred):**
        ```bash
        # (Optional) Create a tsconfig.json if you don't have one: npx tsc --init
        # Compile the TypeScript file to JavaScript
        npx tsc server_reminder_script_example.ts
        # Run the compiled JavaScript file
        node server_reminder_script_example.js
        ```
    -   Check the console output for "Firebase Admin SDK initialized successfully," "Match found for user...", or "No matching reminders..." messages and any errors.

### Periodic Execution (Cron Job)
To run the script automatically at regular intervals (e.g., every 5 minutes), use a cron job.

1.  Open your crontab for editing:
    ```bash
    crontab -e
    ```
2.  Add a line to schedule the script. Adjust paths and schedule as needed.
    -   **Example using `ts-node` (runs every 5 minutes):**
        ```cron
        */5 * * * * export GOOGLE_APPLICATION_CREDENTIALS="/opt/medication-reminder/your-service-account-key.json"; /usr/local/bin/npx ts-node /opt/medication-reminder/server_reminder_script_example.ts >> /var/log/medication-reminder/cron.log 2>&1
        ```
    -   **Example using compiled JavaScript file (runs every 5 minutes):**
        ```cron
        */5 * * * * export GOOGLE_APPLICATION_CREDENTIALS="/opt/medication-reminder/your-service-account-key.json"; /usr/bin/node /opt/medication-reminder/server_reminder_script_example.js >> /var/log/medication-reminder/cron.log 2>&1
        ```

    **Important Cron Notes:**
    -   **Full Paths:** Always use full paths for executables (`npx`, `ts-node`, `node`) and the script file itself in cron jobs, as the cron environment often has a minimal `PATH`. You can find full paths using `which npx`, `which ts-node`, `which node`.
    -   **Environment Variable:** Ensure `GOOGLE_APPLICATION_CREDENTIALS` is correctly set within the cron job's execution line (as shown in the examples) or that the cron user's environment has it pre-configured.
    -   **Logging:** Redirect standard output (`>>`) and standard error (`2>&1`) to a log file (e.g., `/var/log/medication-reminder/cron.log`) for troubleshooting. Ensure the log directory exists and is writable by the cron user.
    -   **Server Timezone:** The example script `server_reminder_script_example.ts` assumes the server it runs on is configured to JST (Japan Standard Time) because it uses `new Date()` to determine the current time for comparison with reminder times. If your server is in a different timezone, you'll need to adjust the script's date/time handling logic or ensure the server's system timezone is JST.

### Functionality
-   The script queries Firestore for `userSettings` (where `notificationsEnabled` is true).
-   For each user, it checks their `reminderTimes` against the current server time (assumed to be JST).
-   If a reminder time matches, it fetches the user's FCM token from `userTokens` and sends a push notification via FCM.
-   The default notification is titled "服薬リマインダー" with the body "お薬を飲む時間です".

## 4. Troubleshooting & Notes

-   **Push Notification Issues:**
    -   Check the browser console on the Next.js app for errors related to service worker registration or FCM token retrieval.
    -   Ensure `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is correctly set in `.env.local`.
    -   Verify that the `firebase-messaging-sw.js` in the `public` directory is correctly configured and accessible.
    -   Use the Firebase console (Cloud Messaging section) to send test messages to specific FCM tokens to isolate issues.
    -   Check logs from the `server_reminder_script_example.ts` (if using cron, check the specified log file).
-   **Server-Side Script:** Remember this script is a separate entity from your Next.js application deployment. It needs its own server environment, dependencies, and process management (cron).
-   **Security:** Always protect your Firebase service account key. Do not commit it to your repository. Use environment variables or secure file storage mechanisms.

This README provides a basic guide. Depending on your specific deployment environment and needs, further configurations might be necessary.
