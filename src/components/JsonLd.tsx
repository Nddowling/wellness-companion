// Renders a schema.org JSON-LD <script>. Data is server-controlled (never user
// input passed raw), so dangerouslySetInnerHTML is safe here. Pass a single
// object or an array of objects.
type Json = Record<string, unknown>;

export default function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
