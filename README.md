# のむRhythm

## 1. プロジェクト概要

「のむRhythm」は、ユーザーがお薬の服用状況、スケジュール、服薬遵守を記録・管理するのを支援するための服薬管理アプリケーションです。主な機能には、服薬記録、スケジュール管理、リマインダー（プッシュ通知およびLINE通知経由）、および扶養家族の服薬管理のためのペアレンタルコントロール機能が含まれます。さらに、LINEを通じてAIによる服薬相談も可能です。

このアプリケーションは、Next.jsフロントエンド、Firebaseバックエンド、およびスケジュールされたプッシュ通知リマインダーを送信するための独立したサーバーサイドスクリプトで構成されています。

## 2. 主な機能

-   **服薬記録と管理**: ユーザーは服用したお薬を記録し、履歴を管理できます。
-   **スケジュール管理**: 服薬スケジュールを詳細に設定し、管理できます。
-   **リマインダー通知**:
    -   **Webプッシュ通知**: ブラウザやモバイルデバイスに直接プッシュ通知を送信し、服薬時間を通知します。
    -   **LINE通知**: LINEアカウントと連携することで、LINEメッセージとして服薬リマインダーを受け取ることができます。
-   **ペアレンタルコントロール**: 家族の服薬状況を管理し、必要に応じてリマインダーを設定できます。
-   **AI服薬相談 (LINE連携)**: LINEを通じてAIに服薬に関する質問を投げかけ、一般的な情報やアドバイスを得ることができます。

## 3. アーキテクチャ

本アプリケーションは、以下の主要コンポーネントで構成されています。

```mermaid
graph LR
    subgraph User Interface
        A[Client (Web/Mobile)]
    end

    subgraph Infrastructure
        B(CDN / Load Balancer)
    end

    subgraph Backend Services
        C(Next.js App Server)
        D(Firebase Authentication)
        E(Firebase Functions / API)
        F(Firestore Database)
        G(LINE Messaging API)
        H(Firebase Cloud Messaging)
    end

    A -- UI/Static Assets --> B
    B -- Requests --> C
    A -- Authentication --> D
    A -- API Calls --> E
    D -- Authenticates --> E
    E -- Read/Write Data --> F
    E -- Send LINE Message --> G
    E -- Send Push Notification --> H

    style A fill:#e0f2f7,stroke:#0288d1,stroke-width:2px,color:#000
    style B fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000
    style C fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#000
    style D fill:#ffe0b2,stroke:#ef6c00,stroke-width:2px,color:#000
    style E fill:#ffe0b2,stroke:#ef6c00,stroke-width:2px,color:#000
    style F fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    style G fill:#e1f5fe,stroke:#039be5,stroke-width:2px,color:#000
    style H fill:#ffcdd2,stroke:#d32f2f,stroke-width:2px,color:#000
```

**コンポーネントの説明:**

-   **Next.js フロントエンド**: ユーザーインターフェースを提供し、Firebaseと連携してデータの表示・管理を行います。
-   **LINE Messaging API**: LINEプラットフォームとの連携を担い、ユーザーからのメッセージ受信（Webhook）とメッセージ送信を行います。
-   **Next.js API Route (LINE Webhook)**: LINEからのWebhookイベントを受け取り、`LINE Handler`に処理を渡します。
-   **LINE Handler**: LINEメッセージの解析、アカウント連携、AI相談の処理、LINEへの返信など、LINE関連のロジックを管理します。
-   **Firebase Authentication**: ユーザー認証を管理します。
-   **Firestore Database**: ユーザーデータ、服薬記録、スケジュール、通知設定などをリアルタイムで保存・同期します。
-   **Firebase Cloud Messaging (FCM)**: Webプッシュ通知の送信を管理します。
-   **Gemini AI**: LINEからのAI相談リクエストに対して、服薬に関する情報を提供します。
-   **サーバーサイド リマインダースクリプト**: 独立して動作し、Firestoreからリマインダー情報を取得し、FCMを通じてプッシュ通知を送信します。これはNext.jsアプリケーションのホスティングとは別に、ユーザーが管理するサーバーで実行されます。

## 4. セットアップ

### 4.1. Next.js アプリケーション (フロントエンド)

#### 前提条件
-   Node.js (最新LTS版を推奨)
-   pnpm (または npm/yarn)

#### 環境変数
Next.jsアプリケーションのルートディレクトリに `.env.local` ファイルを作成し、以下のFirebaseおよびLINEの環境変数を設定してください。

```env
# Firebase クライアントサイド設定
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
NEXT_PUBLIC_FIREBASE_VAPID_KEY="YOUR_VAPID_KEY" # Webプッシュ通知 (FCM) に必須。Firebaseプロジェクト設定で生成。

# Firebase Admin SDK (サーバーサイド用 - Next.js API Routes)
# サービスアカウントキーのJSON内容を直接ここに貼り付けるか、ファイルパスを指定
# 例: FIREBASE_SERVICE_ACCOUNT_KEY='{"type": "service_account", ...}'
# または、FIREBASE_SERVICE_ACCOUNT_KEY_PATH="/path/to/your-service-account-key.json"
# セキュリティのため、本番環境では環境変数として設定することを強く推奨します。
FIREBASE_SERVICE_ACCOUNT_KEY="YOUR_FIREBASE_SERVICE_ACCOUNT_KEY_JSON"

# LINE Messaging API 設定 (Next.js API Routes)
LINE_CHANNEL_SECRET="YOUR_LINE_CHANNEL_SECRET"
LINE_CHANNEL_ACCESS_TOKEN="YOUR_LINE_CHANNEL_ACCESS_TOKEN"

# Gemini AI API Key (Next.js API Routes)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```
`"YOUR_..."` の部分を実際の認証情報に置き換えてください。`FIREBASE_SERVICE_ACCOUNT_KEY` は、Firebaseプロジェクト設定からダウンロードできるサービスアカウントキーJSONファイルの内容を直接貼り付けるか、安全な方法で設定してください。

### 4.2. サーバーサイド・リマインダースクリプト (`lib/scheduler.ts` および関連ファイル)

このスクリプトは、スケジュールされた服薬リマインダーのプッシュ通知を送信します。FirestoreおよびFCMとの連携に `firebase-admin` を使用します。**このスクリプトは、ユーザーが管理するサーバー（VPS、専用サーバー、Raspberry Piなど）で実行されるように設計されており、Next.jsアプリケーションのホスティング（Vercelなど）とは別個のものです。**

#### 前提条件 (サーバー側)
-   Node.js (最新LTS版を推奨)
-   npm または pnpm
-   プロジェクト用のFirebaseサービスアカウントキー (JSONファイル)

#### セットアップ手順

1.  **スクリプトとサービスアカウントキーの配置:**
    -   `lib/scheduler.ts` および関連するFirebase Admin SDK初期化ファイル (`lib/firebase-admin.ts`) をサーバー上のディレクトリ (例: `/opt/medication-reminder/`) にコピーします。
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

4.  **手動テスト実行:**
    -   cronジョブを設定する前に、スクリプトを手動でテストします:
    -   **ts-node を使用 (開発/テストに推奨):**
        ```bash
        # 現在のセッションで GOOGLE_APPLICATION_CREDENTIALS が設定されていることを確認
        npx ts-node /opt/medication-reminder/lib/scheduler.ts
        ```
    -   **JavaScriptにコンパイルしてから実行 (本番環境、またはts-nodeを好まない場合):**
        ```bash
        # (任意) tsconfig.json がない場合は作成: npx tsc --init
        # TypeScriptファイルをJavaScriptにコンパイル
        npx tsc /opt/medication-reminder/lib/scheduler.ts
        # コンパイルされたJavaScriptファイルを実行
        node /opt/medication-reminder/lib/scheduler.js
        ```
    -   コンソール出力で "Firebase Admin SDK initialized successfully."、"Match found for user..."、または "No matching reminders..." といったメッセージやエラーが表示されないか確認します。

#### 定期実行 (Cronジョブ)
スクリプトを一定間隔 (例: 5分ごと) で自動実行するには、cronジョブを使用します。

1.  crontabを編集用に開きます:
    ```bash
    crontab -e
    ```
2.  スクリプトをスケジュールする行を追加します。パスやスケジュールは必要に応じて調整してください。
    -   **`ts-node` を使用する例 (5分ごとに実行):**
        ```cron
        */5 * * * * export GOOGLE_APPLICATION_CREDENTIALS="/opt/medication-reminder/your-service-account-key.json"; /usr/local/bin/npx ts-node /opt/medication-reminder/lib/scheduler.ts >> /var/log/medication-reminder/cron.log 2>&1
        ```
    -   **コンパイル済みのJavaScriptファイルを使用する例 (5分ごとに実行):**
        ```cron
        */5 * * * * export GOOGLE_APPLICATION_CREDENTIALS="/opt/medication-reminder/your-service-account-key.json"; /usr/bin/node /opt/medication-reminder/lib/scheduler.js >> /var/log/medication-reminder/cron.log 2>&1
        ```

    **Cron設定の重要な注意点:**
    -   **フルパス:** cronジョブでは、実行可能ファイル (`npx`, `ts-node`, `node`) およびスクリプトファイル自体へのフルパスを常に使用してください。cron環境はしばしば最小限の `PATH` しか持たないためです。フルパスは `which npx`、`which ts-node`、`which node` を使って見つけることができます。
    -   **環境変数:** cronジョブの実行行内で `GOOGLE_APPLICATION_CREDENTIALS` が正しく設定されていること (例に示した通り)、またはcronユーザーの環境に事前に設定されていることを確認してください。
    -   **ロギング:** 標準出力 (`>>`) と標準エラー (`2>&1`) をログファイル (例: `/var/log/medication-reminder/cron.log`) にリダイレクトして、トラブルシューティングに役立ててください。ログディレクトリが存在し、cronユーザーが書き込み可能であることを確認してください。
    -   **サーバータイムゾーン:** サンプルスクリプト `lib/scheduler.ts` は、リマインダー時間との比較のために現在時刻を決定するのに `new Date()` を使用するため、それが実行されるサーバーがJST (日本標準時) に設定されていることを前提としています。サーバーが異なるタイムゾーンにある場合は、スクリプトの日時処理ロジックを調整するか、サーバーのシステムタイムゾーンがJSTであることを確認する必要があります。

## 5. 開発

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

## 6. デプロイ

### 6.1. Next.js アプリケーション

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

#### PM2を使った運用 (本番サーバー向けオプション)
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

### 6.2. LINE Webhook

LINE Messaging APIのWebhook URLとして、デプロイされたNext.jsアプリケーションのAPIルート (`/api/line/webhook`) を設定してください。

## 7. トラブルシューティングと注意点

-   **プッシュ通知の問題:**
    -   Next.jsアプリのブラウザコンソールで、サービスワーカーの登録やFCMトークン取得に関連するエラーを確認してください。
    -   `.env.local` で `NEXT_PUBLIC_FIREBASE_VAPID_KEY` が正しく設定されていることを確認してください。
    -   `public` ディレクトリ内の `firebase-messaging-sw.js` が正しく設定され、アクセス可能であることを確認してください。
    -   Firebaseコンソール (Cloud Messagingセクション) を使用して、特定のFCMトークンにテストメッセージを送信し、問題を切り分けてください。
    -   `lib/scheduler.ts` からのログを確認してください (cronを使用している場合は、指定されたログファイルを確認)。
-   **LINE連携の問題:**
    -   LINE Developersコンソールで、Webhook URLが正しく設定され、検証済みであることを確認してください。
    -   LINE Channel SecretとAccess Tokenが環境変数に正しく設定されていることを確認してください。
    -   Next.jsアプリケーションのログで、`/api/line/webhook` ルートに関連するエラーを確認してください。
-   **サーバーサイドスクリプト:** このスクリプトはNext.jsアプリケーションのデプロイとは別のエンティティであることを忘れないでください。独自のサーバー環境、依存関係、およびプロセス管理 (cron) が必要です。
-   **セキュリティ:** Firebaseサービスアカウントキー、LINE Channel Secret/Access Token、Gemini API Keyは常に保護してください。リポジトリにコミットしないでください。環境変数または安全なファイルストレージメカニズムを使用してください。

このREADMEは基本的なガイドを提供します。特定のデプロイ環境やニーズによっては、さらなる設定が必要になる場合があります。