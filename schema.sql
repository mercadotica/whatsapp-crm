-- Rode isso uma vez no seu banco Postgres (Vercel Postgres, Neon, Supabase, etc.)

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL, -- formato internacional sem símbolos, ex: 5577999999999
  tags TEXT,                  -- ex: "cliente,vip" - opcional, pra segmentar disparos
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  wa_message_id TEXT,          -- id da mensagem retornado pela Meta
  direction TEXT NOT NULL,     -- 'inbound' ou 'outbound'
  body TEXT,
  status TEXT DEFAULT 'sent',  -- sent, delivered, read, failed, received
  raw_payload JSONB,           -- payload bruto, útil pra debug
  media_url TEXT,              -- URL pública do áudio/imagem/documento (Vercel Blob)
  media_mime TEXT,             -- ex: audio/ogg, image/jpeg
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migração pra quem já tinha o banco criado antes dessa versão:
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mime TEXT;

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  message_body TEXT,
  template_name TEXT,          -- se usar template aprovado (envio fora da janela de 24h)
  template_lang TEXT DEFAULT 'pt_BR',
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, running, done, failed
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  error TEXT,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
