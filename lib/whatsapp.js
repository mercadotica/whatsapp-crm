const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v20.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;

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
    const err = new Error(data?.error?.message || 'Erro ao chamar a API do WhatsApp');
    err.details = data;
    throw err;
  }
  return data;
}

// Mensagem de texto livre — só funciona se o contato te respondeu nas últimas 24h
export async function sendTextMessage(toPhone, text) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'text',
    text: { body: text },
  });
}

// Mensagem via template aprovado — funciona a qualquer momento, mesmo fora da janela de 24h.
// O template precisa já existir e estar aprovado no WhatsApp Manager.
export async function sendTemplateMessage(toPhone, templateName, languageCode = 'pt_BR', components = []) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
}

// Mídia recebida (áudio, imagem, documento) vem só com um media id.
// Passo 1: pedir pra Meta a URL temporária (expira em minutos) + mime type.
export async function getMediaInfo(mediaId) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Erro ao buscar info da mídia');
    err.details = data;
    throw err;
  }
  return data; // { url, mime_type, sha256, file_size, id }
}

// Passo 2: baixar o binário de fato dessa URL temporária (precisa do token de novo)
export async function downloadMedia(mediaUrl) {
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error('Erro ao baixar o arquivo de mídia');
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Envia mídia já hospedada na Meta (pelo media id retornado no upload)
export async function sendAudioMessage(toPhone, mediaId) {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'audio',
    audio: { id: mediaId },
  });
}

// Sobe um arquivo de mídia pra Meta antes de poder enviá-lo (fluxo de 2 passos:
// 1. upload -> media_id, 2. envia mensagem referenciando esse media_id)
export async function uploadMedia(buffer, mimeType, filename = 'audio.ogg') {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Erro ao subir mídia');
    err.details = data;
    throw err;
  }
  return data.id; // media_id
}

// Janela de 24h da Meta: mensagem de texto livre só é permitida se o último contato
// (inbound) do cliente foi há menos de 24h. Fora disso, é obrigatório usar template.
export function isWithin24hWindow(lastInboundTimestamp) {
  if (!lastInboundTimestamp) return false;
  const diffMs = Date.now() - new Date(lastInboundTimestamp).getTime();
  return diffMs < 24 * 60 * 60 * 1000;
}
