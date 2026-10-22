import { sql, saveMessage, getLastInboundTimestamp } from '../../../lib/db';
import { uploadMedia, sendAudioMessage, isWithin24hWindow } from '../../../lib/whatsapp';
import { storeMedia } from '../../../lib/media';

// Formatos aceitos pelo WhatsApp Cloud API para áudio.
// Gravação direta do navegador (webm/opus) NÃO é aceita sem conversão —
// por isso aqui é upload de arquivo já num formato compatível.
const ALLOWED_MIME = [
  'audio/aac',
  'audio/mp4',
  'audio/mpeg',
  'audio/amr',
  'audio/ogg',
];

// body: { contact_id, audio_base64, mime_type, filename }
// audio_base64 é o arquivo em base64 (sem o prefixo "data:audio/...;base64,")
export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { contact_id, audio_base64, mime_type, filename } = req.body;
  if (!contact_id || !audio_base64) {
    return res.status(400).json({ error: 'contact_id e audio_base64 são obrigatórios' });
  }
  if (!ALLOWED_MIME.some((m) => mime_type?.startsWith(m))) {
    return res.status(400).json({
      error: `Formato não suportado (${mime_type}). Use AAC, MP4, MP3, AMR ou OGG (Opus).`,
    });
  }

  const contactResult = await sql`SELECT * FROM contacts WHERE id = ${contact_id}`;
  const contact = contactResult.rows[0];
  if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });

  const lastInbound = await getLastInboundTimestamp(contact.id);
  if (!isWithin24hWindow(lastInbound)) {
    return res.status(400).json({
      error: 'Fora da janela de 24h de conversa — áudio avulso só pode ser enviado se o cliente falou com você recentemente.',
    });
  }

  try {
    const buffer = Buffer.from(audio_base64, 'base64');

    const mediaId = await uploadMedia(buffer, mime_type, filename || 'audio.ogg');
    const response = await sendAudioMessage(contact.phone, mediaId);
    const waMessageId = response?.messages?.[0]?.id;

    // Guarda uma cópia própria pra poder tocar de novo no dashboard depois
    // (a URL de mídia da Meta expira, a nossa no Blob não)
    const ownCopyUrl = await storeMedia(buffer, mime_type, waMessageId || `out-${Date.now()}`);

    await saveMessage({
      contactId: contact.id,
      waMessageId,
      direction: 'outbound',
      body: '[Áudio]',
      status: 'sent',
      mediaUrl: ownCopyUrl,
      mediaMime: mime_type,
    });

    return res.status(200).json({ success: true, waMessageId });
  } catch (err) {
    console.error('Erro ao enviar áudio:', err);
    return res.status(500).json({ error: err.message, details: err.details });
  }
}
