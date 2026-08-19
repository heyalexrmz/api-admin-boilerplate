import { Resend } from "resend";
import PasswordResetEmail from "@/emails/password-reset";
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
    from: process.env.RESEND_FROM ?? "Taxo Timbre <onboarding@resend.dev>",
    to,
    subject,
    react,
  });
  if (error) {
    console.error("Resend send failed", error);
    throw new Error(`Failed to send email: ${error.name}`);
  }
}

export async function sendPasswordResetEmail(email: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith("re_xxxx")) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[dev] No RESEND_API_KEY set; password reset link generated for ${email}.\n  ${url}`
      );
      return;
    }
    throw new Error("RESEND_API_KEY is required to send password reset emails.");
  }

  if (process.env.NODE_ENV === "development" && !url.startsWith("http")) {
    console.warn(`[dev] Password reset URL for ${email} was not sent because it is invalid.`);
    return;
  }
  await sendEmail({
    to: email,
    subject: "Restablece tu contraseña de Taxo Timbre",
    react: PasswordResetEmail({ url }),
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
    subject: `${inviterName} te invitó a unirte a ${organizationName} en Taxo Timbre`,
    react: InvitationEmail({ inviterName, organizationName, url }),
  });
}
