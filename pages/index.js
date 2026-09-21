import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function Inbox() {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  async function loadContacts() {
    const res = await fetch('/api/contacts');
    setContacts(await res.json());
  }

  async function loadMessages(contactId) {
    const res = await fetch(`/api/messages?contact_id=${contactId}`);
    setMessages(await res.json());
  }

  useEffect(() => {
    loadContacts();
    const interval = setInterval(loadContacts, 8000); // atualiza lista periodicamente
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    const interval = setInterval(() => loadMessages(selected.id), 5000); // polling simples de novas msgs
    return () => clearInterval(interval);
  }, [selected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!draft.trim() || !selected) return;
    setSending(true);
    try {
      const res = await fetch('/api/send/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: selected.id, body: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
      } else {
        setDraft('');
        loadMessages(selected.id);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="layout">
      <nav className="sidebar">
        <h2>WhatsApp CRM</h2>
        <Link href="/">Inbox</Link>
        <Link href="/contacts">Contatos &amp; Disparo</Link>
      </nav>

      <div className="contact-list">
        {contacts.map((c) => (
          <div
            key={c.id}
            className={`contact-item ${selected?.id === c.id ? 'active' : ''}`}
            onClick={() => setSelected(c)}
          >
            <div className="name">{c.name || c.phone}</div>
            <div className="phone">{c.phone}</div>
          </div>
        ))}
        {contacts.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>
            Nenhuma conversa ainda. Assim que alguém te mandar mensagem, aparece aqui.
          </div>
        )}
      </div>

      <div className="chat-window">
        {selected ? (
          <>
            <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', background: 'white' }}>
              <strong>{selected.name || selected.phone}</strong>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{selected.phone}</div>
            </div>
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`bubble ${m.direction}`}>
                  {m.body}
                  <div className="meta">
                    {new Date(m.created_at).toLocaleString('pt-BR')} · {m.status}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="send-box">
              <input
                type="text"
                placeholder="Digite uma mensagem (só funciona se o cliente falou com você nas últimas 24h)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} disabled={sending}>
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ margin: 'auto', color: '#6b7280' }}>Selecione uma conversa à esquerda</div>
        )}
      </div>
    </div>
  );
}
