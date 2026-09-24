import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [csvText, setCsvText] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [campaign, setCampaign] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [campaignError, setCampaignError] = useState('');

  async function loadContacts() {
    setLoadState('loading');
    try {
      const res = await fetch('/api/contacts');
      if (!res.ok) throw new Error('Falha ao carregar contatos');
      const data = await res.json();
      setContacts(Array.isArray(data) ? data : []);
      setLoadState('ready');
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
      setLoadState('error');
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  function toggleSelect(id) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setCsvText(evt.target.result);
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText.trim()) {
      setImportResult({ error: 'Cole ou selecione um CSV primeiro (colunas: nome,telefone)' });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/contacts/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult({ error: data.error || 'Erro ao importar CSV' });
        return;
      }
      setImportResult(data);
      setCsvText('');
      loadContacts();
    } catch (err) {
      console.error('Erro ao importar CSV:', err);
      setImportResult({ error: 'Erro de conexão ao importar o CSV. Tente novamente.' });
    } finally {
      setImporting(false);
    }
  }

  async function handleStartCampaign() {
    setCampaignError('');
    if (!messageBody.trim() && !templateName.trim()) {
      setCampaignError('Escreva uma mensagem ou informe o nome de um template aprovado');
      return;
    }
    const contactIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;

    try {
      const res = await fetch('/api/send/bulk-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Campanha ${new Date().toLocaleString('pt-BR')}`,
          message_body: messageBody || undefined,
          template_name: templateName || undefined,
          contact_ids: contactIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCampaignError(data.error || 'Erro ao iniciar campanha');
        return;
      }
      setCampaign(data);
      runBatches(data.id, data.total_contacts);
    } catch (err) {
      console.error('Erro ao iniciar campanha:', err);
      setCampaignError('Erro de conexão ao iniciar a campanha. Tente novamente.');
    }
  }

  async function runBatches(campaignId, total) {
    setProcessing(true);
    let sentSoFar = 0;
    let done = false;
    try {
      while (!done) {
        const res = await fetch('/api/send/bulk-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId, batch_size: 10 }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCampaignError(data.error || 'Erro ao processar lote de envio');
          setCampaign((prev) => ({ ...prev, status: 'failed' }));
          return;
        }
        if (data.done) {
          done = true;
        } else {
          sentSoFar += data.sent + data.failed;
          setCampaign((prev) => ({ ...prev, sent_count: sentSoFar, total_contacts: total }));
        }
      }
      setCampaign((prev) => ({ ...prev, status: 'done' }));
    } catch (err) {
      console.error('Erro ao processar campanha:', err);
      setCampaignError(
        'A conexão caiu durante o envio. Não feche esta aba durante um disparo — evolua para uma fila de verdade (ver plano P3) para não depender disso.'
      );
      setCampaign((prev) => ({ ...prev, status: 'failed' }));
    } finally {
      setProcessing(false);
    }
  }

  const progressPct = campaign?.total_contacts
    ? Math.min(100, Math.round(((campaign.sent_count || 0) / campaign.total_contacts) * 100))
    : 0;

  return (
    <div className="layout">
      <nav className="sidebar">
        <h2>WhatsApp CRM</h2>
        <Link href="/">Inbox</Link>
        <Link href="/contacts">Contatos &amp; Disparo</Link>
      </nav>

      <main className="content">
        <div className="card">
          <h3>Importar contatos (CSV)</h3>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            Arquivo CSV com colunas <code>nome,telefone</code> (telefone no formato internacional, ex: 5577999999999)
          </p>
          <input type="file" accept=".csv" onChange={handleFileUpload} />
          <br /><br />
          <textarea
            placeholder="ou cole o conteúdo do CSV aqui..."
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <br /><br />
          <button onClick={handleImport} disabled={importing}>
            {importing ? 'Importando...' : 'Importar'}
          </button>

          {importResult && (
            <div className={`state-banner ${importResult.error ? 'state-error' : 'state-success'}`}>
              {importResult.error ? (
                importResult.error
              ) : (
                <>
                  ✅ {importResult.created} contato(s) novo(s) importado(s).
                  {importResult.duplicates > 0 && ` ${importResult.duplicates} já existia(m) e foram ignorado(s).`}
                  {importResult.failed?.length > 0 && ` ${importResult.failed.length} linha(s) com erro (ex: telefone inválido).`}
                </>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Disparo em massa</h3>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            {selectedIds.size > 0
              ? `${selectedIds.size} contato(s) selecionado(s) na lista abaixo`
              : 'Nenhum contato selecionado — vai enviar para TODOS os contatos cadastrados'}
          </p>
          <textarea
            placeholder="Mensagem de texto (só chega em quem falou com você nas últimas 24h)"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
          />
          <br /><br />
          <input
            type="text"
            placeholder="OU nome de um template aprovado na Meta (funciona pra qualquer contato)"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            style={{ width: '100%' }}
          />
          <br /><br />
          <button onClick={handleStartCampaign} disabled={processing}>
            {processing ? 'Enviando campanha...' : 'Iniciar disparo'}
          </button>

          {campaignError && <div className="state-banner state-error">{campaignError}</div>}

          {campaign && (
            <div style={{ marginTop: 16 }}>
              <div>
                {campaign.sent_count || 0} / {campaign.total_contacts} enviados
                {campaign.status === 'done' && ' — concluído ✅'}
                {campaign.status === 'failed' && ' — interrompido ⚠️'}
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Contatos ({contacts.length})</h3>

          {loadState === 'loading' && <div className="state-banner">Carregando contatos...</div>}

          {loadState === 'error' && (
            <div className="state-banner state-error">
              Não foi possível carregar os contatos.{' '}
              <button onClick={loadContacts} style={{ marginLeft: 8 }}>Tentar de novo</button>
            </div>
          )}

          {loadState === 'ready' && contacts.length === 0 && (
            <div className="state-banner">
              Nenhum contato cadastrado ainda. Importe um CSV acima para começar.
            </div>
          )}

          {loadState === 'ready' && contacts.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Última mensagem</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </td>
                    <td>{c.name || <span style={{ color: '#9ca3af' }}>{c.phone || 'sem nome'}</span>}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.last_message_at ? new Date(c.last_message_at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
