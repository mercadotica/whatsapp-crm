import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

function formatListTime(value) {
  if (!value) return '';

  const date = new Date(value);
  const now = new Date();

  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / 86400000
  );

  if (diffDays === 0) {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (diffDays === 1) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export default function Inbox() {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const audioInputRef = useRef(null);
  const selectedIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Marca a conversa como lida no banco e zera o contador na tela
  async function markAsRead(contactId) {
    setContacts((current) =>
      current.map((c) =>
        c.id === contactId ? { ...c, unread_count: 0 } : c
      )
    );

    try {
      await fetch('/api/contacts/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      });
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  }

  async function loadContacts() {
    try {
      const res = await fetch('/api/contacts', {
        cache: 'no-store',
      });
      const data = await res.json();

      if (Array.isArray(data)) {
        const openId = selectedIdRef.current;
        const isVisible =
          typeof document === 'undefined' ||
          document.visibilityState === 'visible';

        // Chegou mensagem nova na conversa que já está aberta:
        // ela conta como lida (igual WhatsApp Web)
        const openContact = data.find((c) => c.id === openId);

        if (openContact && openContact.unread_count > 0 && isVisible) {
          markAsRead(openId);

          setContacts(
            data.map((c) =>
              c.id === openId ? { ...c, unread_count: 0 } : c
            )
          );
        } else {
          setContacts(data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  }

  async function loadMessages(contactId) {
    try {
      const res = await fetch(
        `/api/messages?contact_id=${contactId}`
      );

      const data = await res.json();

      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  }

  useEffect(() => {
    loadContacts();

    const interval = setInterval(
      loadContacts,
      8000
    );

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;

    if (!selected) {
      setMessages([]);
      return;
    }

    loadMessages(selected.id);

    const interval = setInterval(
      () => loadMessages(selected.id),
      5000
    );

    return () => clearInterval(interval);
  }, [selected]);

  const totalUnread = contacts.reduce(
    (sum, c) => sum + (c.unread_count || 0),
    0
  );

  useEffect(() => {
    document.title =
      totalUnread > 0
        ? `(${totalUnread}) Mercadótica CRM`
        : 'Mercadótica CRM';
  }, [totalUnread]);

  // Ao voltar pra aba com uma conversa aberta, marca como lida
  useEffect(() => {
    function handleVisibility() {
      if (
        document.visibilityState === 'visible' &&
        selectedIdRef.current
      ) {
        loadContacts();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  async function handleSend() {
    if (!draft.trim() || !selected) return;

    setSending(true);

    try {
      const res = await fetch('/api/send/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contact_id: selected.id,
          body: draft,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      setDraft('');
      await loadMessages(selected.id);
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  }

  async function handleAudioFileChange(event) {
    const file = event.target.files?.[0];

    if (!file || !selected) return;

    setSending(true);

    try {
      const base64 = await fileToBase64(file);

      const res = await fetch('/api/send/audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contact_id: selected.id,
          audio_base64: base64,
          mime_type: file.type,
          filename: file.name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      await loadMessages(selected.id);
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar áudio.');
    } finally {
      setSending(false);
      event.target.value = '';
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(
          reader.result.split(',')[1]
        );
      };

      reader.onerror = reject;

      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="layout">

      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            M
          </div>

          <div>
            <strong>Mercadótica</strong>
            <span>WhatsApp CRM</span>
          </div>
        </div>

        <div className="sidebar-section-title">
          Workspace
        </div>

        <div className="sidebar-nav">
          <Link
            href="/"
            className="sidebar-link active"
          >
            Inbox
            {totalUnread > 0 && (
              <span className="sidebar-unread-badge">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </Link>

          <Link
            href="/contacts"
            className="sidebar-link"
          >
            Contatos & Disparos
          </Link>
        </div>

        <div className="sidebar-footer">
          <span className="sidebar-status-dot" />

          <div>
            <strong>WhatsApp conectado</strong>
            <small>Operação ativa</small>
          </div>
        </div>
      </nav>

      <section className="contact-list">

        <div className="contact-list-header">
          <div>
            <span>Conversas</span>
            <strong>{contacts.length}</strong>
          </div>
        </div>

        <div className="contact-list-scroll">
          {contacts.map((contact) => {
            const unread = contact.unread_count || 0;
            const isActive = selected?.id === contact.id;

            return (
              <button
                key={contact.id}
                type="button"
                className={`contact-item ${
                  isActive ? 'active' : ''
                } ${unread > 0 ? 'unread' : ''}`}
                onClick={() => {
                  setSelected(contact);

                  if (unread > 0) {
                    markAsRead(contact.id);
                  }
                }}
              >
                <div className="contact-avatar">
                  {String(
                    contact.name ||
                      contact.phone ||
                      '?'
                  )
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div className="contact-info">
                  <div className="contact-name">
                    {contact.name ||
                      contact.phone}
                  </div>

                  <div className="contact-phone">
                    {contact.phone}
                  </div>

                  {contact.last_message && (
                    <div className="contact-last-message">
                      {contact.last_message_direction === 'outbound'
                        ? 'Você: '
                        : ''}
                      {contact.last_message}
                    </div>
                  )}
                </div>

                <div className="contact-meta">
                  <span className="contact-time">
                    {formatListTime(contact.last_message_at)}
                  </span>

                  {unread > 0 && (
                    <span className="unread-badge">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {contacts.length === 0 && (
            <div className="contacts-empty-inbox">
              Nenhuma conversa ainda.
              <span>
                Assim que alguém enviar uma
                mensagem, ela aparecerá aqui.
              </span>
            </div>
          )}
        </div>
      </section>

      <main className="chat-window">

        {selected ? (
          <>
            <header className="chat-header">
              <div className="chat-contact-avatar">
                {String(
                  selected.name ||
                    selected.phone ||
                    '?'
                )
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div>
                <strong>
                  {selected.name ||
                    selected.phone}
                </strong>

                <span>
                  {selected.phone}
                </span>
              </div>
            </header>

            <div className="messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`bubble ${message.direction}`}
                >
                  {message.media_url &&
                  message.media_mime?.startsWith(
                    'audio'
                  ) ? (
                    <audio
                      controls
                      src={message.media_url}
                    />
                  ) : message.media_url &&
                    message.media_mime?.startsWith(
                      'image'
                    ) ? (
                    <img
                      src={message.media_url}
                      alt="Imagem recebida"
                    />
                  ) : (
                    message.body
                  )}

                  <div className="meta">
                    {new Date(
                      message.created_at
                    ).toLocaleString('pt-BR')}

                    {' · '}

                    {message.status}
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            <div className="send-box">

              <input
                type="text"
                placeholder="Digite uma mensagem..."
                value={draft}
                onChange={(event) =>
                  setDraft(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
              />

              <button
                type="button"
                onClick={handleSend}
                disabled={
                  sending ||
                  !draft.trim()
                }
              >
                {sending
                  ? 'Enviando...'
                  : 'Enviar'}
              </button>

              <input
                type="file"
                accept="audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,.mp3,.ogg,.m4a,.amr"
                ref={audioInputRef}
                onChange={handleAudioFileChange}
                style={{
                  display: 'none',
                }}
              />

              <button
                type="button"
                onClick={() =>
                  audioInputRef.current?.click()
                }
                disabled={sending}
                title="Enviar arquivo de áudio"
                className="audio-button"
              >
                Áudio
              </button>

            </div>
          </>
        ) : (
          <div className="empty-chat">
            <div className="empty-chat-icon">
              M
            </div>

            <strong>
              Selecione uma conversa
            </strong>

            <span>
              Escolha um contato à esquerda para
              visualizar a conversa.
            </span>
          </div>
        )}

      </main>
    </div>
  );
}