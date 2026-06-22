import { createServerFn } from "@tanstack/react-start";

const RESEND_API_URL = "https://api.resend.com/emails";

// Resend's sandbox sender — works without verifying a custom domain. Swap for a
// verified address (e.g. "SOLO.drive <compliance@yourdomain.com>") once a domain
// is verified in the Resend dashboard.
const FROM_ADDRESS = "SOLO.drive <onboarding@resend.dev>";

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

async function sendViaResend(payload: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on the server");
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend request failed (${res.status}): ${body}`);
  }
}

function emailShell(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a; line-height: 1.5;">
      <h2 style="margin-bottom: 16px;">${title}</h2>
      ${bodyHtml}
      <p style="margin-top: 24px; color: #666;">— The SOLO.drive Compliance Team</p>
    </div>
  `;
}

export const sendOperatorSuspensionEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { to: string; operatorName: string; reason: string }) => data)
  .handler(async ({ data }) => {
    const name = escapeHtml(data.operatorName);
    const reason = escapeHtml(data.reason);
    await sendViaResend({
      to: data.to,
      subject: "Your SOLO.drive operator account has been suspended",
      html: emailShell(
        "Account suspended",
        `
          <p>Hi ${name},</p>
          <p>Your SOLO.drive operator account has been suspended by our compliance team for the following reason:</p>
          <blockquote style="border-left: 3px solid #999; margin: 16px 0; padding: 4px 16px; color: #333;">${reason}</blockquote>
          <p>You will not be able to accept rides while your account is suspended.</p>
          <p><strong>To request reinstatement:</strong> reply to this email or contact SOLO.drive support with information or documentation addressing the issue above. A compliance team member will review your account and restore access once the issue has been resolved.</p>
        `,
      ),
    });
    return { ok: true as const };
  });

export const sendOperatorReinstatementEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { to: string; operatorName: string }) => data)
  .handler(async ({ data }) => {
    const name = escapeHtml(data.operatorName);
    await sendViaResend({
      to: data.to,
      subject: "Your SOLO.drive operator account has been reinstated",
      html: emailShell(
        "Account reinstated",
        `
          <p>Hi ${name},</p>
          <p>Good news — your SOLO.drive operator account has been reviewed by our compliance team and reinstated. You can resume accepting rides immediately.</p>
          <p>Thanks for your patience while we resolved this.</p>
        `,
      ),
    });
    return { ok: true as const };
  });
