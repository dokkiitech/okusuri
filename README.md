# 服薬管理アプリケーション

## 1. プロジェクト概要

これは、ユーザーがお薬の服用状況、スケジュール、服薬遵守を記録・管理するのを支援するための服薬管理アプリケーションです。主な機能には、服薬記録、スケジュール管理、リマインダー（プッシュ通知経由）、および扶養家族の服薬管理のためのペアレンタルコントロール機能が含まれます。

このアプリケーションは、Next.jsフロントエンドと、オプションでスケジュールされたプッシュ通知リマインダーを送信するためのサーバーサイドスクリプトで構成されています。

## 2. Next.js アプリケーション (フロントエンド)

### 前提条件
- Node.js (最新LTS版を推奨)
- pnpm (または npm/yarn)

### 環境変数
Next.jsアプリケーションのルートディレクトリに `.env.local` ファイルを作成してください。このファイルにはFirebaseクライアントサイド設定を保存します。

**必要なFirebase環境変数:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# このVAPIDキーはWebプッシュ通知 (Firebase Cloud Messaging) に不可欠です
# Firebaseプロジェクト設定で生成してください: プロジェクト設定 > Cloud Messaging > ウェブ設定 > ウェブプッシュ証明書
NEXT_PUBLIC_FIREBASE_VAPID_KEY="YOUR_VAPID_KEY"
```
`"YOUR_..."` の部分を実際のFirebaseプロジェクトの認証情報に置き換えてください。

### 開発
1.  **依存関係のインストール:**
    ```bash
    pnpm install
    # または: npm install
    ```
2.  **開発サーバーの実行:**
    ```bash
    pnpm dev
    # または: npm run dev
    ```
    通常、アプリケーションは `http://localhost:3000` で利用可能になります。

### 本番ビルドと実行
1.  **アプリケーションのビルド:**
    ```bash
    pnpm build
    # または: npm run build
    ```
2.  **本番サーバーの起動:**
    ```bash
    pnpm start
    # または: npm run start
    ```

### PM2を使った運用 (本番サーバー向けオプション)
サーバー上でNext.jsの本番プロセスを管理するために、PM2は推奨されるプロセス管理ツールです。
```bash
# 例: pnpm の start スクリプトを使ってアプリを起動
pm2 start pnpm --name "medication-app" -- run start

# または、より複雑な設定のために ecosystem.config.js ファイルを作成します:
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

## 3. サーバーサイド・リマインダースクリプト (`server_reminder_script_example.ts`)

### 目的
このスクリプトは、スケジュールされた服薬リマインダーのプッシュ通知を送信します。FirestoreおよびFCMとの連携に `firebase-admin` を使用します。**このスクリプトは、ユーザーが管理するサーバー（VPS、専用サーバー、Raspberry Piなど）で実行されるように設計されており、Next.jsアプリケーションのホスティング（Vercelなど）とは別個のものです。** Vercelのサーバーレス関数には実行時間制限があり、継続的に実行されるcronのようなジョブには適していない場合があるため、このスクリプトは独自のサーバーを管理するユーザー向けの代替手段を提供します。

### 前提条件 (サーバー側)
- Node.js (最新LTS版を推奨)
- npm または pnpm
- プロジェクト用のFirebaseサービスアカウントキー (JSONファイル)

### セットアップ手順

1.  **スクリプトとサービスアカウントキーの配置:**
    -   `server_reminder_script_example.ts` (リポジトリルートから) をサーバー上のディレクトリ (例: `/opt/medication-reminder/`) にコピーします。
    -   Firebaseプロジェクト設定 (`プロジェクト設定 > サービスアカウント > 新しい秘密鍵を生成`) からFirebaseサービスアカウントキーのJSONファイルをダウンロードします。
    -   このキーファイル (例: `your-service-account-key.json`) を同じディレクトリに配置します。
    -   **重要: このサービスアカウントキーファイルを安全に保管してください。適切なファイル権限を設定し (例: `chmod 600 your-service-account-key.json`)、公開アクセスできないようにしてください。**

2.  **依存関係のインストール:**
    -   スクリプトを配置したディレクトリ (例: `/opt/medication-reminder/`) に移動します:
        ```bash
        cd /opt/medication-reminder/
        ```
    -   `package.json` を初期化し、必要な依存関係をインストールします:
        ```bash
        npm init -y
        npm install firebase-admin typescript ts-node
        # または、先にJavaScriptにコンパイルしてnodeで実行する場合:
        # npm install firebase-admin typescript
        ```

3.  **サービスアカウントキーパスの設定:**
    -   スクリプトはデフォルトで `GOOGLE_APPLICATION_CREDENTIALS` 環境変数を使用します。
    -   この環境変数をサービスアカウントキーJSONファイルのフルパスに設定します。この行をシェルのプロファイル (例: `~/.bashrc`, `~/.zshrc`) に追加するか、cronジョブの実行行で直接設定します。
        ```bash
        export GOOGLE_APPLICATION_CREDENTIALS="/opt/medication-reminder/your-service-account-key.json"
        ```
        (変更を新しいセッションで有効にするには、`source ~/.bashrc` を実行するか、ログアウト/ログインすることを忘れないでください。)
    -   または (セキュリティ上推奨されず、本番環境では非推奨)、`server_reminder_script_example.ts` 内の `SERVICE_ACCOUNT_KEY_PATH` 変数を直接変更することもできます。

4.  **手動テスト実行:**
    -   cronジョブを設定する前に、スクリプトを手動でテストします:
    -   **ts-node を使用 (開発/テストに推奨):**
        ```bash
        # 現在のセッションで GOOGLE_APPLICATION_CREDENTIALS が設定されていることを確認
        npx ts-node server_reminder_script_example.ts
        ```
    -   **JavaScriptにコンパイルしてから実行 (本番環境、またはts-nodeを好まない場合):**
        ```bash
        # (任意) tsconfig.json がない場合は作成: npx tsc --init
        # TypeScriptファイルをJavaScriptにコンパイル
        npx tsc server_reminder_script_example.ts
        # コンパイルされたJavaScriptファイルを実行
        node server_reminder_script_example.js
        ```
    -   コンソール出力で "Firebase Admin SDK initialized successfully."、"Match found for user..."、または "No matching reminders..." といったメッセージやエラーが表示されないか確認します。

### 定期実行 (Cronジョブ)
スクリプトを一定間隔 (例: 5分ごと) で自動実行するには、cronジョブを使用します。

1.  crontabを編集用に開きます:
    ```bash
    crontab -e
    ```
2.  スクリプトをスケジュールする行を追加します。パスやスケジュールは必要に応じて調整してください。
    -   **`ts-node` を使用する例 (5分ごとに実行):**
        ```cron
        */5 * * * * export GOOGLE_APPLICATION_CREDENTIALS="/opt/medication-reminder/your-service-account-key.json"; /usr/local/bin/npx ts-node /opt/medication-reminder/server_reminder_script_example.ts >> /var/log/medication-reminder/cron.log 2>&1
        ```
    -   **コンパイル済みのJavaScriptファイルを使用する例 (5分ごとに実行):**
        ```cron
        */5 * * * * export GOOGLE_APPLICATION_CREDENTIALS="/opt/medication-reminder/your-service-account-key.json"; /usr/bin/node /opt/medication-reminder/server_reminder_script_example.js >> /var/log/medication-reminder/cron.log 2>&1
        ```

    **Cron設定の重要な注意点:**
    -   **フルパス:** cronジョブでは、実行可能ファイル (`npx`, `ts-node`, `node`) およびスクリプトファイル自体へのフルパスを常に使用してください。cron環境はしばしば最小限の `PATH` しか持たないためです。フルパスは `which npx`、`which ts-node`、`which node` を使って見つけることができます。
    -   **環境変数:** cronジョブの実行行内で `GOOGLE_APPLICATION_CREDENTIALS` が正しく設定されていること (例に示した通り)、またはcronユーザーの環境に事前に設定されていることを確認してください。
    -   **ロギング:** 標準出力 (`>>`) と標準エラー (`2>&1`) をログファイル (例: `/var/log/medication-reminder/cron.log`) にリダイレクトして、トラブルシューティングに役立ててください。ログディレクトリが存在し、cronユーザーが書き込み可能であることを確認してください。
    -   **サーバータイムゾーン:** サンプルスクリプト `server_reminder_script_example.ts` は、リマインダー時間との比較のために現在時刻を決定するのに `new Date()` を使用するため、それが実行されるサーバーがJST (日本標準時) に設定されていることを前提としています。サーバーが異なるタイムゾーンにある場合は、スクリプトの日時処理ロジックを調整するか、サーバーのシステムタイムゾーンがJSTであることを確認する必要があります。

### 機能概要
-   スクリプトはFirestoreの `userSettings` (`notificationsEnabled` がtrueのもの) をクエリします。
-   ユーザーごとに、`reminderTimes` を現在のサーバー時刻 (JSTと想定) と比較します。
-   リマインダー時刻が一致する場合、`userTokens` からユーザーのFCMトークンを取得し、FCM経由でプッシュ通知を送信します。
-   デフォルトの通知は、タイトルが「服薬リマインダー」、本文が「お薬を飲む時間です」となります。

## 4. トラブルシューティングと注意点

-   **プッシュ通知の問題:**
    -   Next.jsアプリのブラウザコンソールで、サービスワーカーの登録やFCMトークン取得に関連するエラーを確認してください。
    -   `.env.local` で `NEXT_PUBLIC_FIREBASE_VAPID_KEY` が正しく設定されていることを確認してください。
    -   `public` ディレクトリ内の `firebase-messaging-sw.js` が正しく設定され、アクセス可能であることを確認してください。
    -   Firebaseコンソール (Cloud Messagingセクション) を使用して、特定のFCMトークンにテストメッセージを送信し、問題を切り分けてください。
    -   `server_reminder_script_example.ts` からのログを確認してください (cronを使用している場合は、指定されたログファイルを確認)。
-   **サーバーサイドスクリプト:** このスクリプトはNext.jsアプリケーションのデプロイとは別のエンティティであることを忘れないでください。独自のサーバー環境、依存関係、およびプロセス管理 (cron) が必要です。
-   **セキュリティ:** Firebaseサービスアカウントキーは常に保護してください。リポジトリにコミットしないでください。環境変数または安全なファイルストレージメカニズムを使用してください。

このREADMEは基本的なガイドを提供します。特定のデプロイ環境やニーズによっては、さらなる設定が必要になる場合があります。
