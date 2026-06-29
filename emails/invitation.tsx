import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

export default function InvitationEmail({
  inviterName,
  organizationName,
  url,
}: {
  inviterName: string;
  organizationName: string;
  url: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{inviterName} invited you to join {organizationName} on Acme</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "20px" }}>You&apos;re invited to join {organizationName}</Heading>
          <Text>
            <strong>{inviterName}</strong> has invited you to collaborate on the{" "}
            <strong>{organizationName}</strong> workspace in Acme. Click the button below to
            accept the invitation and set up your account.
          </Text>
          <Link
            href={url}
            style={{ display: "inline-block", backgroundColor: "#000", color: "#fff", padding: "12px 20px", borderRadius: "6px", textDecoration: "none" }}
          >
            Accept invitation
          </Link>
          <Text style={{ color: "#666", fontSize: "13px" }}>
            This invitation expires in 7 days. If you weren&apos;t expecting an invite, you can
            safely ignore this email.
          </Text>
          <Hr />
          <Text style={{ color: "#999", fontSize: "12px" }}>Acme Inc.</Text>
        </Container>
      </Body>
    </Html>
  );
}
