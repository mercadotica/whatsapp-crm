import { sql } from '@vercel/postgres';

export { sql };

export async function getOrCreateContact({ name, phone }) {
  const cleanPhone = String(phone).replace(/\D/g, '');

  const existing = await sql`
    SELECT * FROM contacts
    WHERE phone = ${cleanPhone}
  `;

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const inserted = await sql`
    INSERT INTO contacts (name, phone)
    VALUES (${name || cleanPhone}, ${cleanPhone})
    RETURNING *
  `;

  return inserted.rows[0];
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