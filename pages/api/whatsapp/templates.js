const GRAPH_VERSION =
  process.env.GRAPH_API_VERSION ||
  'v20.0';

const WABA_ID =
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

const TOKEN =
  process.env.WHATSAPP_TOKEN;

export default async function handler(
  req,
  res
) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  if (!WABA_ID) {
    return res.status(500).json({
      error:
        'WHATSAPP_BUSINESS_ACCOUNT_ID não está configurado.',
    });
  }

  if (!TOKEN) {
    return res.status(500).json({
      error:
        'WHATSAPP_TOKEN não está configurado.',
    });
  }

  try {
    const templates = [];

    let nextUrl =
      `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates` +
      `?fields=name,status,language,category,components&limit=100`;

    while (nextUrl) {
      const response =
        await fetch(nextUrl, {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
          },
        });

      const data =
        await response.json();

      if (!response.ok) {
        const error = new Error(
          data?.error?.message ||
            'Erro ao buscar templates da Meta'
        );

        error.details = data;

        throw error;
      }

      if (Array.isArray(data.data)) {
        templates.push(
          ...data.data
        );
      }

      nextUrl =
        data?.paging?.next ||
        null;
    }

    const approved =
      templates
        .filter(
          (template) =>
            String(
              template.status
            ).toUpperCase() ===
            'APPROVED'
        )
        .sort((a, b) => {
          const nameCompare =
            String(a.name).localeCompare(
              String(b.name)
            );

          if (nameCompare !== 0) {
            return nameCompare;
          }

          return String(
            a.language
          ).localeCompare(
            String(b.language)
          );
        });

    return res.status(200).json({
      templates: approved,
    });
  } catch (err) {
    console.error(
      'Erro ao carregar templates:',
      err
    );

    return res.status(500).json({
      error:
        err.message ||
        'Erro ao carregar templates',
      details: err.details,
    });
  }
}