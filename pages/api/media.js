import { get } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      error: 'URL da mídia é obrigatória',
    });
  }

  try {
    const blobUrl = new URL(url);

    const result = await get(blobUrl.pathname, {
      access: 'private',
    });

    if (!result) {
      return res.status(404).json({
        error: 'Mídia não encontrada',
      });
    }

    res.setHeader(
      'Content-Type',
      result.blob.contentType || 'application/octet-stream'
    );

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache');

    if (result.blob.etag) {
      res.setHeader('ETag', result.blob.etag);
    }

    const reader = result.stream.getReader();

    res.status(200);

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      res.write(Buffer.from(value));
    }

    res.end();
  } catch (error) {
    console.error('Erro ao buscar mídia:', error);

    return res.status(500).json({
      error: error.message || 'Erro ao carregar mídia',
    });
  }
}