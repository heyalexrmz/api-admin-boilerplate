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

export default function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html>
      <Head />
      <Preview>Sign in to your Acme workspace</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "20px" }}>Your Acme sign-in link</Heading>
          <Text>Click the button below to sign in to your Acme workspace. This link expires shortly and can only be used once.</Text>
          <Link
            href={url}
            style={{ display: "inline-block", backgroundColor: "#000", color: "#fff", padding: "12px 20px", borderRadius: "6px", textDecoration: "none" }}
          >
            Sign in to Acme
          </Link>
          <Text style={{ color: "#666", fontSize: "13px" }}>If you didn&apos;t request this link, you can safely ignore this email.</Text>
          <Hr />
          <Text style={{ color: "#999", fontSize: "12px" }}>Acme Inc.</Text>
        </Container>
      </Body>
    </Html>
  );
}
