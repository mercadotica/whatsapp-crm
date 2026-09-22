import { put } from '@vercel/blob';

// Extensão baseada no mime type, só pra ficar com nome de arquivo legível
const EXT_BY_MIME = {
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/amr': 'amr',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export async function storeMedia(buffer, mimeType, waMediaId) {
  const ext = EXT_BY_MIME[mimeType] || 'bin';
  const filename = `whatsapp-media/${waMediaId}.${ext}`;

  const blob = await put(filename, buffer, {
    access: 'public',
    contentType: mimeType,
    addRandomSuffix: false,
  });

  return blob.url; // URL pública, pode usar direto num <audio src="...">
}
