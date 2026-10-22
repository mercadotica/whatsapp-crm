import { sql } from '../../../lib/db';

// POST /api/contacts/read  { contact_id }
// Marca a conversa como lida (zera o contador de não lidas).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { contact_id } = req.body || {};

  if (!contact_id) {
    return res.status(400).json({ error: 'contact_id é obrigatório' });
  }

  try {
    await sql`
      UPDATE contacts
      SET last_read_at = now()
      WHERE id = ${contact_id}
    `;

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro ao marcar como lida:', error);
    return res.status(500).json({ error: 'Erro ao marcar como lida' });
  }
}
