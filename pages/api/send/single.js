import { sql, saveMessage, getLastInboundTimestamp } from '../../../lib/db';
import { sendTextMessage, sendTemplateMessage, isWithin24hWindow } from '../../../lib/whatsapp';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { contact_id, body, template_name, template_lang } = req.body;
  if (!contact_id) return res.status(400).json({ error: 'contact_id é obrigatório' });

  const contactResult = await sql`SELECT * FROM contacts WHERE id = ${contact_id}`;
  const contact = contactResult.rows[0];
  if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });

  try {
    let response;
    if (template_name) {
      response = await sendTemplateMessage(contact.phone, template_name, template_lang || 'pt_BR');
    } else {
      const lastInbound = await getLastInboundTimestamp(contact.id);
      if (!isWithin24hWindow(lastInbound)) {
        return res.status(400).json({
          error:
            'Fora da janela de 24h de conversa. Use um template aprovado (campo template_name) para enviar.',
        });
      }
      response = await sendTextMessage(contact.phone, body);
    }

    const waMessageId = response?.messages?.[0]?.id;
    await saveMessage({
      contactId: contact.id,
      waMessageId,
      direction: 'outbound',
      body: body || `[template: ${template_name}]`,
      status: 'sent',
    });

    return res.status(200).json({ success: true, waMessageId });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    return res.status(500).json({ error: err.message, details: err.details });
  }
}
