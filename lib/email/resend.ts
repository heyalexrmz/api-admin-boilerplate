import { Resend } from "resend";
import MagicLinkEmail from "@/emails/magic-link";

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
    console.warn(`[dev] No RESEND_API_KEY set — magic link for ${email}: ${url}`);
    return;
  }
  await sendEmail({
    to: email,
    subject: "Your Acme sign-in link",
    react: MagicLinkEmail({ url }),
  });
}
