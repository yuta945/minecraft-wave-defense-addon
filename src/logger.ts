/**
 * Windows版Minecraft/BDSのContentLogファイルは4KBバッファリングされるため、
 * 即座にディスク上の ContentLog*.txt にフラッシュさせるヘルパー関数
 */
export function aiDebugLog(message: string): void {
  console.warn(`[AI-DEBUG] ${message}`);
  const pad = ".".repeat(220);
  for (let i = 0; i < 20; i++) {
    console.warn(`[AI-FLUSH:${i}] ${pad}`);
  }
  console.warn(`[AI-DEBUG-END] ${message}`);
}
