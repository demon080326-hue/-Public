import "server-only";

import type { EmailMessage, EmailSendResult } from "@/lib/email/send-email";

type ResendOptions = {
  apiKey: string;
  from: string;
  replyTo: string | null;
  message: EmailMessage;
};

export async function sendWithResend({ apiKey, from, replyTo, message }: ResendOptions): Promise<EmailSendResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "james-ai-build-log/1.0",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`Resend email delivery failed with HTTP ${response.status}.`);
      return { ok: false, reason: "provider_error" };
    }

    const result = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return {
      ok: true,
      provider: "resend",
      messageId: typeof result?.id === "string" ? result.id : null,
    };
  } catch {
    console.error("Resend email delivery failed before a response was received.");
    return { ok: false, reason: "provider_error" };
  }
}
