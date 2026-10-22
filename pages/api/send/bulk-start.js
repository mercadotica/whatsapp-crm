import { sql } from '../../../lib/db';

export default async function handler(
  req,
  res
) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const {
    name,
    template_name,
    template_lang,
    template_components,
    contact_ids,
  } = req.body;

  if (!template_name) {
    return res.status(400).json({
      error:
        'Selecione um template aprovado.',
    });
  }

  if (
    !Array.isArray(contact_ids) ||
    contact_ids.length === 0
  ) {
    return res.status(400).json({
      error:
        'Selecione pelo menos um contato para o disparo.',
    });
  }

  const normalizedIds = [
    ...new Set(
      contact_ids
        .map((id) => Number(id))
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        )
    ),
  ];

  if (normalizedIds.length === 0) {
    return res.status(400).json({
      error:
        'A lista de contatos selecionada é inválida.',
    });
  }

  const contacts = await sql`
    SELECT id
    FROM contacts
    WHERE id = ANY(${normalizedIds})
  `;

  const validIds =
    contacts.rows.map((row) =>
      Number(row.id)
    );

  if (validIds.length === 0) {
    return res.status(400).json({
      error:
        'Nenhum dos contatos selecionados foi encontrado.',
    });
  }

  const components =
    Array.isArray(
      template_components
    )
      ? template_components
      : [];

  const campaignResult =
    await sql`
      INSERT INTO campaigns (
        name,
        message_body,
        template_name,
        template_lang,
        template_components,
        total_contacts,
        status
      )
      VALUES (
        ${
          name ||
          `Campanha ${new Date().toLocaleString(
            'pt-BR'
          )}`
        },
        NULL,
        ${template_name},
        ${template_lang || 'pt_BR'},
        ${JSON.stringify(
          components
        )}::jsonb,
        ${validIds.length},
        'pending'
      )
      RETURNING *
    `;

  const campaign =
    campaignResult.rows[0];

  for (const contactId of validIds) {
    await sql`
      INSERT INTO campaign_contacts (
        campaign_id,
        contact_id,
        status
      )
      VALUES (
        ${campaign.id},
        ${contactId},
        'pending'
      )
    `;
  }

  return res.status(201).json(
    campaign
  );
}