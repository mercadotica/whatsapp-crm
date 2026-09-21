import { sql, saveMessage, getLastInboundTimestamp } from '../../../lib/db';
import { sendTextMessage, sendTemplateMessage, isWithin24hWindow } from '../../../lib/whatsapp';

// Chame esse endpoint repetidamente (ex: a cada 2-3s pelo front-end) até
// campaign.status === 'done'. Cada chamada processa um lote pequeno,
// com um pequeno intervalo entre mensagens — a Meta pode throttlar ou
// bloquear números que mandam rajadas muito agressivas de mensagem.
//
// body: { campaign_id, batch_size? }
const BATCH_SIZE_DEFAULT = 10;
const DELAY_BETWEEN_MESSAGES_MS = 300; // ~3 msgs/segundo, ajuste conforme seu tier de volume na Meta

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { campaign_id, batch_size } = req.body;
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id é obrigatório' });

  const campaignResult = await sql`SELECT * FROM campaigns WHERE id = ${campaign_id}`;
  const campaign = campaignResult.rows[0];
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const pending = await sql`
    SELECT cc.id as queue_id, c.*
    FROM campaign_contacts cc
    JOIN contacts c ON c.id = cc.contact_id
    WHERE cc.campaign_id = ${campaign_id} AND cc.status = 'pending'
    LIMIT ${batch_size || BATCH_SIZE_DEFAULT}
  `;

  if (pending.rows.length === 0) {
    await sql`UPDATE campaigns SET status = 'done' WHERE id = ${campaign_id}`;
    return res.status(200).json({ done: true, campaign_id });
  }

  await sql`UPDATE campaigns SET status = 'running' WHERE id = ${campaign_id} AND status = 'pending'`;

  let sent = 0;
  let failed = 0;

  for (const contact of pending.rows) {
    try {
      let response;
      if (campaign.template_name) {
        response = await sendTemplateMessage(contact.phone, campaign.template_name, campaign.template_lang);
      } else {
        const lastInbound = await getLastInboundTimestamp(contact.id);
        if (!isWithin24hWindow(lastInbound)) {
          throw new Error('Fora da janela de 24h e a campanha não usa template');
        }
        response = await sendTextMessage(contact.phone, campaign.message_body);
      }

      const waMessageId = response?.messages?.[0]?.id;
      await saveMessage({
        contactId: contact.id,
        waMessageId,
        direction: 'outbound',
        body: campaign.message_body || `[template: ${campaign.template_name}]`,
        status: 'sent',
      });

      await sql`
        UPDATE campaign_contacts SET status = 'sent', processed_at = now()
        WHERE id = ${contact.queue_id}
      `;
      sent++;
    } catch (err) {
      await sql`
        UPDATE campaign_contacts SET status = 'failed', error = ${err.message}, processed_at = now()
        WHERE id = ${contact.queue_id}
      `;
      failed++;
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_MESSAGES_MS));
  }

  await sql`
    UPDATE campaigns
    SET sent_count = sent_count + ${sent}, failed_count = failed_count + ${failed}
    WHERE id = ${campaign_id}
  `;

  const remaining = await sql`
    SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = ${campaign_id} AND status = 'pending'
  `;
  const remainingCount = parseInt(remaining.rows[0].count, 10);

  if (remainingCount === 0) {
    await sql`UPDATE campaigns SET status = 'done' WHERE id = ${campaign_id}`;
  }

  return res.status(200).json({ done: remainingCount === 0, sent, failed, remaining: remainingCount });
}
