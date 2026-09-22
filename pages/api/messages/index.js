import { sql } from '../../../lib/db';
import { issueSignedToken, presignUrl } from '@vercel/blob';

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

    const messages = await Promise.all(
      result.rows.map(async (message) => {
        if (!message.media_url) {
          return message;
        }

        try {
          const blobUrl = new URL(message.media_url);
          const pathname = blobUrl.pathname;

          const validUntil = Date.now() + 60 * 60 * 1000; // 1 hora

          const token = await issueSignedToken({
            pathname,
            operations: ['get'],
            validUntil,
          });

          const { presignedUrl } = await presignUrl(token, {
            pathname,
            operation: 'get',
            validUntil,
          });

          return {
            ...message,
            media_url: presignedUrl,
          };
        } catch (mediaError) {
          console.error('Erro ao gerar URL da mídia:', mediaError);

          return {
            ...message,
            media_url: null,
          };
        }
      })
    );

    return res.status(200).json(messages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);

    return res.status(500).json({
      error: 'Erro ao buscar mensagens',
    });
  }
}