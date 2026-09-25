const GRAPH_VERSION =
  process.env.GRAPH_API_VERSION || 'v20.0';

const PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID;

const TOKEN =
  process.env.WHATSAPP_TOKEN;

const BASE_URL =
  `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;

async function callGraphApi(payload) {
  const res = await fetch(BASE_URL, {
    method: 'POST',

    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(
      data?.error?.message ||
        'Erro ao chamar a API do WhatsApp'
    );

    err.details = data;

    throw err;
  }

  return data;
}

export async function sendTextMessage(
  toPhone,
  text
) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'text',
    text: {
      body: text,
    },
  });
}

export async function sendTemplateMessage(
  toPhone,
  templateName,
  languageCode = 'pt_BR',
  components = []
) {
  const template = {
    name: templateName,
    language: {
      code: languageCode,
    },
  };

  if (
    Array.isArray(components) &&
    components.length > 0
  ) {
    template.components = components;
  }

  return callGraphApi({
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template,
  });
}

export async function getMediaInfo(
  mediaId
) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(
      data?.error?.message ||
        'Erro ao buscar info da mídia'
    );

    err.details = data;

    throw err;
  }

  return data;
}

export async function downloadMedia(
  mediaUrl
) {
  const res = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(
      'Erro ao baixar o arquivo de mídia'
    );
  }

  const arrayBuffer =
    await res.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

export async function sendAudioMessage(
  toPhone,
  mediaId
) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'audio',
    audio: {
      id: mediaId,
    },
  });
}

export async function uploadMedia(
  buffer,
  mimeType,
  filename = 'audio.ogg'
) {
  const form = new FormData();

  form.append(
    'messaging_product',
    'whatsapp'
  );

  form.append(
    'file',
    new Blob([buffer], {
      type: mimeType,
    }),
    filename
  );

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/media`,
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },

      body: form,
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(
      data?.error?.message ||
        'Erro ao subir mídia'
    );

    err.details = data;

    throw err;
  }

  return data.id;
}

export function isWithin24hWindow(
  lastInboundTimestamp
) {
  if (!lastInboundTimestamp) {
    return false;
  }

  const diffMs =
    Date.now() -
    new Date(
      lastInboundTimestamp
    ).getTime();

  return (
    diffMs <
    24 * 60 * 60 * 1000
  );
}