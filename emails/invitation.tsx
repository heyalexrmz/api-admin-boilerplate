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
      <Preview>{inviterName} te invitó a unirte a {organizationName} en Taxo Timbre</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "20px" }}>Te invitaron a unirte a {organizationName}</Heading>
          <Text>
            <strong>{inviterName}</strong> te invitó a colaborar en el espacio de trabajo{" "}
            <strong>{organizationName}</strong> en Taxo Timbre. Haz clic en el botón para
            aceptar la invitación y configurar tu cuenta.
          </Text>
          <Link
            href={url}
            style={{ display: "inline-block", backgroundColor: "#000", color: "#fff", padding: "12px 20px", borderRadius: "6px", textDecoration: "none" }}
          >
            Aceptar invitación
          </Link>
          <Text style={{ color: "#666", fontSize: "13px" }}>
            Esta invitación vence en 7 días. Si no esperabas esta invitación, puedes
            ignorar este correo.
          </Text>
          <Hr />
          <Text style={{ color: "#999", fontSize: "12px" }}>Taxo Timbre</Text>
        </Container>
      </Body>
    </Html>
  );
}
