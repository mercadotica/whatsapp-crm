import { get } from '@vercel/blob';
import { Readable } from 'stream';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      error: 'URL da mídia é obrigatória',
    });
  }

  try {
    const blobUrl = new URL(url);

    const result = await get(blobUrl.pathname.replace(/^\/+/, ''), {
      access: 'private',
    });

    if (!result) {
      return res.status(404).json({
        error: 'Mídia não encontrada',
      });
    }

    res.statusCode = 200;

    res.setHeader(
      'Content-Type',
      result.blob.contentType || 'application/octet-stream'
    );

    res.setHeader('Content-Length', result.blob.size);

    res.setHeader('Cache-Control', 'private, no-cache');

    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (result.blob.etag) {
      res.setHeader('ETag', result.blob.etag);
    }

    Readable.fromWeb(result.stream).pipe(res);

  } catch (error) {
    console.error('Erro ao buscar mídia:', error);

    return res.status(500).json({
      error: error.message || 'Erro ao carregar mídia',
    });
  }
}