import { sql, getOrCreateContact } from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const result = await sql`
      SELECT c.*,
        (SELECT created_at FROM messages m WHERE m.contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM contacts c
      ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC
    `;
    return res.status(200).json(result.rows);
  }

  if (req.method === 'POST') {
    const { name, phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Telefone é obrigatório' });
    const contact = await getOrCreateContact({ name, phone });
    return res.status(201).json(contact);
  }

  res.status(405).end();
}
