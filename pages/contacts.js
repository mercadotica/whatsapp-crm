import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [csvText, setCsvText] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [campaign, setCampaign] = useState(null);
  const [processing, setProcessing] = useState(false);

  async function loadContacts() {
    const res = await fetch('/api/contacts');
    setContacts(await res.json());
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
    if (!csvText.trim()) return alert('Cole ou selecione um CSV primeiro (colunas: nome,telefone)');
    const res = await fetch('/api/contacts/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText }),
    });
    const data = await res.json();
    alert(`Importado: ${data.created} contatos. Falhas: ${data.failed?.length || 0}`);
    setCsvText('');
    loadContacts();
  }

  async function handleStartCampaign() {
    if (!messageBody.trim() && !templateName.trim()) {
      return alert('Escreva uma mensagem ou informe o nome de um template aprovado');
    }
    const contactIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;

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
    if (!res.ok) return alert(data.error);
    setCampaign(data);
    runBatches(data.id, data.total_contacts);
  }

  async function runBatches(campaignId, total) {
    setProcessing(true);
    let sentSoFar = 0;
    let done = false;
    while (!done) {
      const res = await fetch('/api/send/bulk-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, batch_size: 10 }),
      });
      const data = await res.json();
      if (data.done) {
        done = true;
      } else {
        sentSoFar += data.sent + data.failed;
        setCampaign((prev) => ({ ...prev, sent_count: sentSoFar, total_contacts: total }));
      }
    }
    setProcessing(false);
    setCampaign((prev) => ({ ...prev, status: 'done' }));
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
          <button onClick={handleImport}>Importar</button>
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

          {campaign && (
            <div style={{ marginTop: 16 }}>
              <div>
                {campaign.sent_count || 0} / {campaign.total_contacts} enviados
                {campaign.status === 'done' && ' — concluído ✅'}
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Contatos ({contacts.length})</h3>
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
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.last_message_at ? new Date(c.last_message_at).toLocaleString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
