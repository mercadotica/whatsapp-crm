import {
  sql,
  saveMessage,
} from '../../../lib/db';

import {
  sendTemplateMessage,
} from '../../../lib/whatsapp';

const BATCH_SIZE_DEFAULT = 10;

const DELAY_BETWEEN_MESSAGES_MS = 300;

function resolveParameter(
  parameter,
  contact
) {
  if (
    parameter.source ===
    'contact.name'
  ) {
    return (
      contact.name ||
      contact.phone ||
      ''
    );
  }

  if (
    parameter.source ===
    'contact.phone'
  ) {
    return contact.phone || '';
  }

  if (
    parameter.source ===
    'static'
  ) {
    return parameter.value || '';
  }

  return '';
}

function resolveTemplateComponents(
  components,
  contact
) {
  if (
    !Array.isArray(components) ||
    components.length === 0
  ) {
    return [];
  }

  return components.map(
    (component) => ({
      type: component.type,

      parameters:
        Array.isArray(
          component.parameters
        )
          ? component.parameters.map(
              (parameter) => ({
                type: 'text',

                text:
                  resolveParameter(
                    parameter,
                    contact
                  ),
              })
            )
          : [],
    })
  );
}

export default async function handler(
  req,
  res
) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const {
    campaign_id,
    batch_size,
  } = req.body;

  if (!campaign_id) {
    return res.status(400).json({
      error:
        'campaign_id é obrigatório',
    });
  }

  const campaignResult =
    await sql`
      SELECT *
      FROM campaigns
      WHERE id = ${campaign_id}
    `;

  const campaign =
    campaignResult.rows[0];

  if (!campaign) {
    return res.status(404).json({
      error:
        'Campanha não encontrada',
    });
  }

  const pending = await sql`
    SELECT
      cc.id AS queue_id,
      c.*
    FROM campaign_contacts cc
    JOIN contacts c
      ON c.id = cc.contact_id
    WHERE
      cc.campaign_id = ${campaign_id}
      AND cc.status = 'pending'
    ORDER BY cc.id
    LIMIT ${
      batch_size ||
      BATCH_SIZE_DEFAULT
    }
  `;

  if (
    pending.rows.length === 0
  ) {
    await sql`
      UPDATE campaigns
      SET status = 'done'
      WHERE id = ${campaign_id}
    `;

    const finalCampaign =
      await sql`
        SELECT *
        FROM campaigns
        WHERE id = ${campaign_id}
      `;

    return res.status(200).json({
      done: true,
      campaign_id,
      sent: 0,
      failed: 0,
      sent_total:
        finalCampaign.rows[0]
          ?.sent_count || 0,
      failed_total:
        finalCampaign.rows[0]
          ?.failed_count || 0,
    });
  }

  await sql`
    UPDATE campaigns
    SET status = 'running'
    WHERE
      id = ${campaign_id}
      AND status = 'pending'
  `;

  let sent = 0;
  let failed = 0;

  let storedComponents =
    campaign.template_components;

  if (
    typeof storedComponents ===
    'string'
  ) {
    try {
      storedComponents =
        JSON.parse(
          storedComponents
        );
    } catch {
      storedComponents = [];
    }
  }

  for (const contact of pending.rows) {
    try {
      const components =
        resolveTemplateComponents(
          storedComponents,
          contact
        );

      const response =
        await sendTemplateMessage(
          contact.phone,
          campaign.template_name,
          campaign.template_lang ||
            'pt_BR',
          components
        );

      const waMessageId =
        response?.messages?.[0]?.id;

      await saveMessage({
        contactId: contact.id,
        waMessageId,
        direction: 'outbound',

        body: `[template: ${campaign.template_name}]`,

        status: 'sent',

        rawPayload: response,
      });

      await sql`
        UPDATE campaign_contacts
        SET
          status = 'sent',
          processed_at = now()
        WHERE id = ${contact.queue_id}
      `;

      sent++;
    } catch (err) {
      await sql`
        UPDATE campaign_contacts
        SET
          status = 'failed',
          error = ${err.message},
          processed_at = now()
        WHERE id = ${contact.queue_id}
      `;

      failed++;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          DELAY_BETWEEN_MESSAGES_MS
        )
    );
  }

  await sql`
    UPDATE campaigns
    SET
      sent_count =
        sent_count + ${sent},

      failed_count =
        failed_count + ${failed}

    WHERE id = ${campaign_id}
  `;

  const remaining =
    await sql`
      SELECT
        COUNT(*)::int AS count
      FROM campaign_contacts
      WHERE
        campaign_id = ${campaign_id}
        AND status = 'pending'
    `;

  const remainingCount =
    Number(
      remaining.rows[0]?.count || 0
    );

  const done =
    remainingCount === 0;

  if (done) {
    await sql`
      UPDATE campaigns
      SET status = 'done'
      WHERE id = ${campaign_id}
    `;
  }

  const totals = await sql`
    SELECT
      sent_count,
      failed_count
    FROM campaigns
    WHERE id = ${campaign_id}
  `;

  return res.status(200).json({
    done,
    campaign_id,
    sent,
    failed,
    remaining:
      remainingCount,

    sent_total:
      totals.rows[0]
        ?.sent_count || 0,

    failed_total:
      totals.rows[0]
        ?.failed_count || 0,
  });
}