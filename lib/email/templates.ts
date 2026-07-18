import "server-only";

const DEFAULT_PUBLIC_URL = "https://public-zeta-pink.vercel.app";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getContactUrl() {
  try {
    return new URL("/contact", process.env.APP_PUBLIC_URL || DEFAULT_PUBLIC_URL).toString();
  } catch {
    return `${DEFAULT_PUBLIC_URL}/contact`;
  }
}

export function buildReverificationEmail(code: string) {
  const safeCode = escapeHtml(code);
  const contactUrl = getContactUrl();
  const safeContactUrl = escapeHtml(contactUrl);
  const subject = "【重啟實驗室】你的 6 位數安全驗證碼";

  const text = [
    "重啟實驗室 James AI Build Log",
    "",
    "你正在進行帳號安全重新驗證。",
    `你的 6 位數驗證碼：${code}`,
    "",
    "此驗證碼將在 10 分鐘後失效。",
    "如果不是你本人操作，請忽略此信。請勿回覆驗證碼，也不要向任何人提供密碼。",
    `需要協助：${contactUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="zh-Hant">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f4f5f7;color:#15171a;font-family:Arial,'Noto Sans TC',sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #dfe3e8;border-radius:8px;padding:32px;">
        <p style="margin:0 0 8px;color:#59636e;font-size:14px;">重啟實驗室 James AI Build Log</p>
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.4;">帳號安全重新驗證</h1>
        <p style="margin:0 0 20px;line-height:1.7;">請在網站輸入以下 6 位數驗證碼：</p>
        <p style="margin:0 0 20px;padding:16px;background:#f1f3f5;border-radius:6px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;">${safeCode}</p>
        <p style="margin:0 0 12px;line-height:1.7;">此驗證碼將在 <strong>10 分鐘</strong>後失效。</p>
        <p style="margin:0 0 20px;line-height:1.7;color:#59636e;">如果不是你本人操作，請忽略此信。請勿回覆驗證碼，也不要向任何人提供密碼。</p>
        <p style="margin:0;line-height:1.7;"><a href="${safeContactUrl}" style="color:#155eef;">聯絡重啟實驗室</a></p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
