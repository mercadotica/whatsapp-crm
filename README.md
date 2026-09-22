# WhatsApp CRM (envio em massa + inbox)

Sistema próprio usando a **API oficial do WhatsApp Business (Cloud API / Meta)** —
não é automação não-oficial, então não corre risco de banimento por volume desde
que você respeite os limites de tier da sua conta.

## O que faz
- Recebe mensagens do WhatsApp via webhook e salva no banco (pra você ver de novo,
  já que perdeu o acesso pelo celular ao migrar o número pra API)
- Recebe e toca **áudios** (e mostra imagens) direto no dashboard — o arquivo é
  baixado da Meta e guardado no Vercel Blob
- **Envia áudio** também: botão "🎵 Áudio" na conversa, você escolhe um arquivo
  .mp3/.ogg/.m4a/.amr do computador (gravação direta do navegador não é usada
  porque o formato nativo do navegador — WebM — não é aceito pela Meta sem
  conversão)
- Envia mensagem individual (dentro da janela de 24h) ou por template (a qualquer hora)
- Importa lista de clientes via CSV e dispara em massa, em lotes, com intervalo entre
  mensagens
- Dashboard simples: Inbox (conversas) + Contatos/Disparo

## 0. Migração (se você já tinha o banco criado antes)
Rode de novo o `schema.sql` — ele tem `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
pras colunas novas de mídia (`media_url`, `media_mime`), então é seguro rodar de
novo sem duplicar nada.

Crie também um **Blob Store** na Vercel: no seu projeto → Storage → Blob →
Create → Connect ao projeto. Isso gera a variável `BLOB_READ_WRITE_TOKEN`
automaticamente (tier gratuito cobre bastante volume de áudio).

## 1. Banco de dados
Crie um Postgres (mais simples: no próprio dashboard da Vercel → **Storage → Postgres**,
ou use [Neon](https://neon.tech), que tem free tier e conecta igual).

Depois de criar, rode o `schema.sql` deste projeto nele (pelo próprio painel do
Neon/Vercel tem um "SQL editor", ou use `psql` com a connection string).

## 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` (localmente) e preencha:

- `WHATSAPP_TOKEN` — token de acesso do seu app (Meta for Developers → seu App →
  WhatsApp → API Setup). Para produção, gere um **token permanente** via System User
  em Business Settings, o token temporário expira em 24h.
- `WHATSAPP_PHONE_NUMBER_ID` — também na tela de API Setup
- `WEBHOOK_VERIFY_TOKEN` — você inventa uma string qualquer, só precisa bater com o
  que você cadastrar no passo 4
- `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` — vem do painel do banco (se usar
  Vercel Postgres, é gerado automático ao conectar o projeto)
- `DASHBOARD_PASSWORD` — senha pra proteger o painel (usuário fixo `admin`)

## 3. Rodar localmente
```bash
npm install
npm run dev
```
Abre em `http://localhost:3000` (vai pedir usuário `admin` e a senha que você definiu).

## 4. Deploy na Vercel
```bash
npm i -g vercel
vercel
```
Ou conecte o repositório do GitHub direto no painel da Vercel. Configure as mesmas
variáveis de ambiente lá em **Settings → Environment Variables**.

## 5. Configurar o Webhook na Meta
No painel do seu App (Meta for Developers) → WhatsApp → Configuration:
- **Callback URL**: `https://SEU-DOMINIO.vercel.app/api/webhook`
- **Verify Token**: o mesmo valor que você colocou em `WEBHOOK_VERIFY_TOKEN`
- Inscreva o campo `messages` (Webhook Fields)

## Limitações importantes a saber
- **Janela de 24h**: você só pode mandar texto livre para quem te escreveu nas
  últimas 24h. Fora disso, é **obrigatório usar um template aprovado** (cadastrado
  no WhatsApp Manager e aprovado pela Meta, leva algumas horas pra aprovar).
- **Rate limit / tier de volume**: sua conta começa num tier baixo (geralmente
  1.000 conversas iniciadas/dia) e cresce conforme a qualidade e volume de uso.
  Envie em ritmo razoável (o código já espaça as mensagens) — picos agressivos
  podem derrubar sua "quality rating" mesmo usando a API oficial.
- **Opt-in**: a política da Meta exige que os contatos tenham consentido em
  receber mensagens suas. Listas compradas/frias tendem a gerar bloqueios de
  qualidade rapidamente.
- Esse projeto não tem fila persistente (Redis/SQS) — o disparo em massa roda
  enquanto a aba do navegador estiver aberta chamando `/api/send/bulk-process`
  repetidamente. Pra volumes muito grandes (dezenas de milhares), vale evoluir
  isso para uma fila de verdade (ex: Vercel Cron + Upstash Queue).
