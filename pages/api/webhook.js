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
// GET  -> verificação inicial do webhook
// POST -> mensagens novas, status de entrega, etc.

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleVerify(req, res);
  }

  if (req.method === 'POST') {
    return handleIncoming(req, res);
  }

  return res.status(405).end();
}

function handleVerify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (
    mode === 'subscribe' &&
    token === process.env.WEBHOOK_VERIFY_TOKEN
  ) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Token de verificação inválido');
}

async function handleIncoming(req, res) {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // ============================================================
    // IDENTIFICA O NÚMERO QUE RECEBEU O EVENTO
    // ============================================================

    const receivedPhoneNumberId =
      value?.metadata?.phone_number_id;

    const receivedPhoneNumber =
      value?.metadata?.display_phone_number;

    const configuredPhoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    console.log('======================================');
    console.log('WEBHOOK WHATSAPP');
    console.log('ID configurado no CRM:', configuredPhoneNumberId);
    console.log('ID recebido da Meta:', receivedPhoneNumberId);
    console.log('Número recebido:', receivedPhoneNumber);
    console.log('======================================');

    // ============================================================
    // FILTRO DO NÚMERO
    //
    // O CRM só processará eventos do número definido no .env
    //
    // WHATSAPP_PHONE_NUMBER_ID=ID_DO_NUMERO_DO_CRM
    //
    // Se for o número da Wellon, o evento será ignorado.
    // ============================================================

    if (
      configuredPhoneNumberId &&
      receivedPhoneNumberId &&
      receivedPhoneNumberId !== configuredPhoneNumberId
    ) {
      console.log(
        'Evento ignorado: pertence a outro número do WhatsApp.'
      );

      return res.status(200).send('EVENT_IGNORED');
    }

    // ============================================================
    // MENSAGENS RECEBIDAS DO CLIENTE
    // ============================================================

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

        // ========================================================
        // MÍDIA
        // ========================================================

        if (
          MEDIA_TYPES.includes(msg.type) &&
          msg[msg.type]?.id
        ) {
          try {
            const mediaInfo = await getMediaInfo(
              msg[msg.type].id
            );

            const buffer = await downloadMedia(
              mediaInfo.url
            );

            mediaUrl = await storeMedia(
              buffer,
              mediaInfo.mime_type,
              msg[msg.type].id
            );

            mediaMime = mediaInfo.mime_type;

            body =
              body ||
              LABEL_BY_TYPE[msg.type] ||
              `[${msg.type}]`;
          } catch (mediaErr) {
            console.error(
              'Erro ao baixar mídia:',
              mediaErr,
              mediaErr.details
            );

            const reason =
              mediaErr.details?.error?.message ||
              mediaErr.message ||
              'erro desconhecido';

            body =
              body ||
              `[${msg.type} - falha ao baixar: ${reason}]`;
          }
        }

        body =
          body ||
          `[mensagem do tipo ${msg.type}]`;

        // ========================================================
        // SALVA A MENSAGEM NO BANCO
        // ========================================================

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

        console.log(
          `Mensagem recebida de ${msg.from} salva no CRM.`
        );
      }
    }

    // ============================================================
    // ATUALIZAÇÕES DE STATUS
    //
    // entregue, lido, falhou etc.
    // ============================================================

    if (value?.statuses?.length) {
      for (const status of value.statuses) {
        await sql`
          UPDATE messages
          SET status = ${status.status}
          WHERE wa_message_id = ${status.id}
        `;

        console.log(
          `Status atualizado: ${status.id} -> ${status.status}`
        );
      }
    }

    // ============================================================
    // RESPOSTA PARA A META
    // ============================================================

    return res
      .status(200)
      .send('EVENT_RECEIVED');

  } catch (err) {
    console.error('Erro no webhook:', err);

    // Retorna 200 para evitar que a Meta fique reenviando
    // o mesmo evento indefinidamente.
    return res
      .status(200)
      .send('EVENT_RECEIVED');
  }
}