import { NextResponse } from 'next/server';
import os from 'os';
import { execSync } from 'child_process';

// 必須環境変数リスト
const REQUIRED_ENV = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'NEXT_PUBLIC_GEMINI_API_KEY',
];

export async function GET() {
  const start = Date.now();

  // 環境変数チェック
  const envCheck = Object.fromEntries(REQUIRED_ENV.map(key => [key, !!process.env[key]]));
  const envAllOk = Object.values(envCheck).every(Boolean);

  // ディスク容量取得
  let disk = {};
  try {
    const df = execSync("df -k | grep -E '^/dev/'").toString();
    const lines = df.trim().split('\n');
    disk = lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        filesystem: parts[0],
        sizeKB: Number(parts[1]),
        usedKB: Number(parts[2]),
        availKB: Number(parts[3]),
        usePercent: parts[4],
        mount: parts[8] || parts[7] || '',
      };
    });
  } catch (e) {
    disk = { error: '取得失敗' };
  }

  // メモリ・CPU
  let mem = {};
  let cpu = {};
  try {
    const free = os.freemem();
    const total = os.totalmem();
    mem = {
      free,
      total,
      used: total - free,
      usedPercent: Math.round(((total - free) / total) * 100),
    };
    // CPU
    const cpus = os.cpus();
    cpu = {
      model: cpus[0].model,
      cores: cpus.length,
      loadavg: os.loadavg(),
    };
  } catch (e) {
    mem = { error: '取得失敗' };
    cpu = { error: '取得失敗' };
  }

  // エラーログ件数（直近1000行）
  let errorLogCount = null;
  try {
    const count = execSync("tail -n 1000 /private/var/log/system.log | grep -i error | wc -l").toString();
    errorLogCount = Number(count.trim());
  } catch (e) {
    errorLogCount = null;
  }

  // レスポンスタイム
  const responseTimeMs = Date.now() - start;

  return NextResponse.json({
    status: 'ok',
    checks: {
      env: { allOk: envAllOk, details: envCheck },
      disk,
      mem,
      cpu,
      errorLogCount,
      responseTimeMs,
    },
  }, { status: 200 });
} 