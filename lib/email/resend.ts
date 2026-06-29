import { Resend } from "resend";
import MagicLinkEmail from "@/emails/magic-link";
import InvitationEmail from "@/emails/invitation";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "Acme <onboarding@resend.dev>",
    to,
    subject,
    react,
  });
  if (error) {
    console.error("Resend send failed", error);
    throw new Error(`Failed to send email: ${error.name}`);
  }
}

export async function sendMagicLinkEmail(email: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith("re_xxxx")) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[dev] No RESEND_API_KEY set; magic link generated for ${email}. Configure Resend to receive it.`
      );
      return;
    }
    throw new Error("RESEND_API_KEY is required to send magic-link emails.");
  }

  if (process.env.NODE_ENV === "development" && !url.startsWith("http")) {
    console.warn(`[dev] Magic link URL for ${email} was not sent because it is invalid.`);
    return;
  }
  await sendEmail({
    to: email,
    subject: "Your Acme sign-in link",
    react: MagicLinkEmail({ url }),
  });
}

export async function sendInvitationEmail({
  to,
  inviterName,
  organizationName,
  invitationId,
}: {
  to: string;
  inviterName: string;
  organizationName: string;
  invitationId: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const url = `${baseURL}/invite?invitationId=${encodeURIComponent(invitationId)}`;

  if (!key || key.startsWith("re_xxxx")) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[dev] No RESEND_API_KEY set; invitation link for ${to} logged instead of emailed.\n  ${url}`
      );
      return;
    }
    throw new Error("RESEND_API_KEY is required to send invitation emails.");
  }

  await sendEmail({
    to,
    subject: `${inviterName} invited you to join ${organizationName} on Acme`,
    react: InvitationEmail({ inviterName, organizationName, url }),
  });
}
