import { sql } from '../../../lib/db';

// GET /api/messages?contact_id=123
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { contact_id } = req.query;

  if (!contact_id) {
    return res.status(400).json({
      error: 'contact_id é obrigatório',
    });
  }

  try {
    const result = await sql`
      SELECT *
      FROM messages
      WHERE contact_id = ${contact_id}
      ORDER BY created_at ASC
    `;

    const messages = result.rows.map((message) => {
      if (message.media_url) {
        return {
          ...message,
          media_url: `/api/media?url=${encodeURIComponent(message.media_url)}`,
        };
      }

      return message;
    });

    return res.status(200).json(messages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);

    return res.status(500).json({
      error: 'Erro ao buscar mensagens',
    });
  }
}