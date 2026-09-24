import { sql, getOrCreateContact } from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const result = await sql`
      SELECT c.*,
        lm.created_at as last_message_at,
        lm.body as last_message,
        lm.direction as last_message_direction,
        lm.status as last_message_status
      FROM contacts c
      LEFT JOIN LATERAL (
        SELECT body, direction, status, created_at
        FROM messages m
        WHERE m.contact_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) lm ON true
      ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC
    `;
    return res.status(200).json(result.rows);
  }

  if (req.method === 'POST') {
    const { name, phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Telefone é obrigatório' });
    try {
      const contact = await getOrCreateContact({ name, phone });
      return res.status(201).json(contact);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  res.status(405).end();
}
