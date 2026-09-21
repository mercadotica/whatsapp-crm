import { sql } from '../../../lib/db';

// Cria a campanha e a fila de contatos a processar.
// O envio de fato acontece em lotes pequenos via /api/send/bulk-process,
// chamado repetidamente pelo front-end — isso evita estourar o timeout
// de função serverless da Vercel quando a lista é grande.
//
// body: { name, message_body, template_name, template_lang, contact_ids: [1,2,3] }
// Se contact_ids vier vazio/ausente, envia para TODOS os contatos cadastrados.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, message_body, template_name, template_lang, contact_ids } = req.body;

  if (!message_body && !template_name) {
    return res.status(400).json({ error: 'Informe message_body ou template_name' });
  }

  let ids = contact_ids;
  if (!ids || ids.length === 0) {
    const all = await sql`SELECT id FROM contacts`;
    ids = all.rows.map((r) => r.id);
  }

  if (ids.length === 0) {
    return res.status(400).json({ error: 'Nenhum contato para enviar' });
  }

  const campaign = await sql`
    INSERT INTO campaigns (name, message_body, template_name, template_lang, total_contacts, status)
    VALUES (${name || 'Campanha sem nome'}, ${message_body || null}, ${template_name || null}, ${template_lang || 'pt_BR'}, ${ids.length}, 'pending')
    RETURNING *
  `;
  const campaignId = campaign.rows[0].id;

  // Insere a fila em lote
  for (const contactId of ids) {
    await sql`
      INSERT INTO campaign_contacts (campaign_id, contact_id)
      VALUES (${campaignId}, ${contactId})
    `;
  }

  return res.status(201).json(campaign.rows[0]);
}
