import { getOrCreateContact, saveMessage, sql } from '../../lib/db';

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

        const body =
          msg.text?.body ||
          msg.button?.text ||
          msg.interactive?.button_reply?.title ||
          `[mensagem do tipo ${msg.type}]`;

        await saveMessage({
          contactId: contact.id,
          waMessageId: msg.id,
          direction: 'inbound',
          body,
          status: 'received',
          rawPayload: msg,
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
