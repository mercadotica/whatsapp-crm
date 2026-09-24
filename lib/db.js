import { sql } from '@vercel/postgres';

export { sql };

export function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  // Formato internacional sem símbolos, ex: 5577999999999 (10 a 15 dígitos cobre a maioria dos países)
  return digits.length >= 10 && digits.length <= 15;
}

export async function getOrCreateContact({ name, phone }) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');

  if (!isValidPhone(cleanPhone)) {
    const err = new Error(
      `Telefone inválido: "${phone}" (deve ter entre 10 e 15 dígitos, com DDI+DDD, ex: 5577999999999)`
    );
    err.code = 'INVALID_PHONE';
    throw err;
  }

  const existing = await sql`
    SELECT * FROM contacts
    WHERE phone = ${cleanPhone}
  `;

  if (existing.rows.length > 0) {
    // Contato já existe: atualiza o nome só se um nome novo e não-vazio foi enviado
    // e o contato existente ainda não tinha nome (evita sobrescrever com CSVs incompletos).
    if (name && !existing.rows[0].name) {
      const updated = await sql`
        UPDATE contacts SET name = ${name} WHERE id = ${existing.rows[0].id}
        RETURNING *
      `;
      return { ...updated.rows[0], _duplicate: true };
    }
    return { ...existing.rows[0], _duplicate: true };
  }

  const inserted = await sql`
    INSERT INTO contacts (name, phone)
    VALUES (${name || cleanPhone}, ${cleanPhone})
    RETURNING *
  `;

  return { ...inserted.rows[0], _duplicate: false };
}

export async function saveMessage({
  contactId,
  waMessageId,
  direction,
  body,
  status,
  rawPayload,
  mediaUrl,
  mediaMime,
}) {
  await sql`
    INSERT INTO messages (
      contact_id,
      wa_message_id,
      direction,
      body,
      status,
      raw_payload,
      media_url,
      media_mime
    )
    VALUES (
      ${contactId},
      ${waMessageId || null},
      ${direction},
      ${body || ''},
      ${status || 'sent'},
      ${rawPayload ? JSON.stringify(rawPayload) : null},
      ${mediaUrl || null},
      ${mediaMime || null}
    )
  `;
}

export async function getLastInboundTimestamp(contactId) {
  const result = await sql`
    SELECT created_at
    FROM messages
    WHERE contact_id = ${contactId}
      AND direction = 'inbound'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return result.rows[0]?.created_at || null;
}