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
      <Preview>Inicia sesión en Taxo Timbre</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "20px" }}>Tu enlace de acceso a Taxo Timbre</Heading>
          <Text>Haz clic en el botón para iniciar sesión en tu espacio de trabajo. Este enlace vence pronto y solo se puede usar una vez.</Text>
          <Link
            href={url}
            style={{ display: "inline-block", backgroundColor: "#000", color: "#fff", padding: "12px 20px", borderRadius: "6px", textDecoration: "none" }}
          >
            Iniciar sesión
          </Link>
          <Text style={{ color: "#666", fontSize: "13px" }}>Si no solicitaste este enlace, puedes ignorar este correo.</Text>
          <Hr />
          <Text style={{ color: "#999", fontSize: "12px" }}>Taxo Timbre</Text>
        </Container>
      </Body>
    </Html>
  );
}
