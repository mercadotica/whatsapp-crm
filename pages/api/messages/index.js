import { sql } from '../../../lib/db';

// GET /api/messages?contact_id=123
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { contact_id } = req.query;
  if (!contact_id) return res.status(400).json({ error: 'contact_id é obrigatório' });

  const result = await sql`
    SELECT * FROM messages
    WHERE contact_id = ${contact_id}
    ORDER BY created_at ASC
  `;
  return res.status(200).json(result.rows);
}
