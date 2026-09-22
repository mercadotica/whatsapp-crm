import { getOrCreateContact, saveMessage, sql } from '../../lib/db';
import { getMediaInfo, downloadMedia } from '../../lib/whatsapp';
import { storeMedia } from '../../lib/media';

const MEDIA_TYPES = ['audio', 'image', 'video', 'document'];

const LABEL_BY_TYPE = {
  audio: '[Áudio]',
  image: '[Imagem]',
  video: '[Vídeo]',
  document: '[Documento]',
};

// A Meta chama esse endpoint de duas formas:
// GET  -> verificação inicial do webhook (você cola essa URL no painel da Meta)
// POST -> toda vez que chega mensagem nova, status de entrega, etc.

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleVerify(req, res);
  }
  if (req.method === 'POST') {
    return handleIncoming(req, res);
  }
  res.status(405).end();
}

function handleVerify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Token de verificação inválido');
}

async function handleIncoming(req, res) {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Mensagens recebidas do cliente
    if (value?.messages?.length) {
      for (const msg of value.messages) {
        const contactInfo = value.contacts?.[0];
        const contact = await getOrCreateContact({
          name: contactInfo?.profile?.name,
          phone: msg.from,
        });

        let body =
          msg.text?.body ||
          msg.button?.text ||
          msg.interactive?.button_reply?.title ||
          null;

        let mediaUrl = null;
        let mediaMime = null;

        if (MEDIA_TYPES.includes(msg.type) && msg[msg.type]?.id) {
          try {
            const mediaInfo = await getMediaInfo(msg[msg.type].id);
            const buffer = await downloadMedia(mediaInfo.url);
            mediaUrl = await storeMedia(buffer, mediaInfo.mime_type, msg[msg.type].id);
            mediaMime = mediaInfo.mime_type;
            body = body || LABEL_BY_TYPE[msg.type] || `[${msg.type}]`;
          } catch (mediaErr) {
            console.error('Erro ao baixar mídia:', mediaErr);
            body = body || `[${msg.type} - falha ao baixar]`;
          }
        }

        body = body || `[mensagem do tipo ${msg.type}]`;

        await saveMessage({
          contactId: contact.id,
          waMessageId: msg.id,
          direction: 'inbound',
          body,
          status: 'received',
          rawPayload: msg,
          mediaUrl,
          mediaMime,
        });
      }
    }

    // Atualizações de status (entregue, lido, falhou) de mensagens que você enviou
    if (value?.statuses?.length) {
      for (const status of value.statuses) {
        await sql`
          UPDATE messages SET status = ${status.status}
          WHERE wa_message_id = ${status.id}
        `;
      }
    }

    // A Meta espera sempre um 200 rápido, senão ela reenvia o evento
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Erro no webhook:', err);
    // Ainda assim retorna 200 pra Meta não ficar reenviando indefinidamente
    return res.status(200).send('EVENT_RECEIVED');
  }
}
