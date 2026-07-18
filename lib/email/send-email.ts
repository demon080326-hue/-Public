import "server-only";

import { sendWithResend } from "@/lib/email/providers/resend";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

export type EmailSendResult =
  | { ok: true; provider: "resend"; messageId: string | null }
  | { ok: false; reason: "not_configured" | "unsupported_provider" | "provider_error" };

type EmailDeliveryConfiguration =
  | {
      configured: true;
      provider: "resend";
      apiKey: string;
      from: string;
      replyTo: string | null;
    }
  | {
      configured: false;
      reason: "not_configured" | "unsupported_provider";
    };

export function getEmailDeliveryConfiguration(): EmailDeliveryConfiguration {
  const provider = (process.env.AUTH_EMAIL_PROVIDER || "resend").trim().toLowerCase();
  if (provider !== "resend") {
    return { configured: false, reason: "unsupported_provider" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { configured: false, reason: "not_configured" };
  }

  return {
    configured: true,
    provider: "resend",
    apiKey,
    from,
    replyTo: process.env.AUTH_EMAIL_REPLY_TO?.trim() || null,
  };
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const configuration = getEmailDeliveryConfiguration();
  if (!configuration.configured) {
    return { ok: false, reason: configuration.reason };
  }

  return sendWithResend({
    apiKey: configuration.apiKey,
    from: configuration.from,
    replyTo: configuration.replyTo,
    message,
  });
}
