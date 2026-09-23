import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function Inbox() {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);

  const audioInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ============================================================
  // FUNÇÕES DE SEGURANÇA
  // ============================================================

  function safeText(value, fallback = '') {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  function safeId(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  // ============================================================
  // CONTATOS
  // ============================================================

  async function loadContacts() {
    try {
      const res = await fetch('/api/contacts');

      const data = await res.json();

      if (!res.ok) {
        console.error(
          'Erro ao carregar contatos:',
          data
        );
        return;
      }

      if (!Array.isArray(data)) {
        console.error(
          'Resposta inválida de /api/contacts:',
          data
        );
        return;
      }

      setContacts(data);
    } catch (error) {
      console.error(
        'Erro ao carregar contatos:',
        error
      );
    }
  }

  // ============================================================
  // MENSAGENS
  // ============================================================

  async function loadMessages(contactId) {
    if (
      contactId === null ||
      contactId === undefined ||
      contactId === ''
    ) {
      setMessages([]);
      return;
    }

    try {
      const res = await fetch(
        `/api/messages?contact_id=${encodeURIComponent(
          contactId
        )}`
      );

      const data = await res.json();

      if (!res.ok) {
        console.error(
          'Erro da API de mensagens:',
          data
        );

        setMessages([]);
        return;
      }

      if (!Array.isArray(data)) {
        console.error(
          'Resposta inválida de /api/messages:',
          data
        );

        setMessages([]);
        return;
      }

      setMessages(data);
    } catch (error) {
      console.error(
        'Erro ao carregar mensagens:',
        error
      );

      setMessages([]);
    }
  }

  // ============================================================
  // CARREGAR CONTATOS
  // ============================================================

  useEffect(() => {
    loadContacts();

    const interval = setInterval(() => {
      loadContacts();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // CARREGAR MENSAGENS DO CONTATO
  // ============================================================

  useEffect(() => {
    if (!selectedContactId) {
      setMessages([]);
      return;
    }

    loadMessages(selectedContactId);

    const interval = setInterval(() => {
      loadMessages(selectedContactId);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedContactId]);

  // ============================================================
  // SCROLL
  // ============================================================

  useEffect(() => {
    if (!selectedContactId) return;

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
      });
    }, 100);
  }, [messages, selectedContactId]);

  // ============================================================
  // SELECIONAR CONTATO
  // ============================================================

  function handleSelectContact(contact) {
    if (!contact) return;

    const id = safeId(contact.id);

    console.log(
      'Contato selecionado:',
      contact
    );

    console.log(
      'ID do contato:',
      id
    );

    if (!id) {
      console.error(
        'Contato sem ID:',
        contact
      );

      return;
    }

    setSelected(contact);
    setSelectedContactId(id);
    setMessages([]);
    setDraft('');
    setShowEmoji(false);
  }

  // ============================================================
  // ENVIAR TEXTO
  // ============================================================

  async function handleSend() {
    if (
      !draft.trim() ||
      !selectedContactId ||
      sending
    ) {
      return;
    }

    setSending(true);

    try {
      const res = await fetch('/api/send/single', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          contact_id: selectedContactId,
          body: draft,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(
          data?.error ||
            'Erro ao enviar mensagem.'
        );

        return;
      }

      setDraft('');
      setShowEmoji(false);

      await loadMessages(
        selectedContactId
      );
    } catch (error) {
      console.error(
        'Erro ao enviar mensagem:',
        error
      );

      alert(
        'Erro ao enviar mensagem.'
      );
    } finally {
      setSending(false);
    }
  }

  // ============================================================
  // ENTER
  // ============================================================

  function handleKeyDown(e) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey
    ) {
      e.preventDefault();

      handleSend();
    }
  }

  // ============================================================
  // ÁUDIO
  // ============================================================

  async function handleAudioFileChange(e) {
    const file = e.target.files?.[0];

    if (
      !file ||
      !selectedContactId
    ) {
      return;
    }

    setSending(true);

    try {
      const base64 =
        await fileToBase64(file);

      const res = await fetch(
        '/api/send/audio',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            contact_id:
              selectedContactId,

            audio_base64: base64,

            mime_type: file.type,

            filename: file.name,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(
          data?.error ||
            'Erro ao enviar áudio.'
        );

        return;
      }

      await loadMessages(
        selectedContactId
      );
    } catch (error) {
      console.error(
        'Erro ao enviar áudio:',
        error
      );

      alert(
        'Erro ao enviar áudio.'
      );
    } finally {
      setSending(false);

      e.target.value = '';
    }
  }

  // ============================================================
  // BASE64
  // ============================================================

  function fileToBase64(file) {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload = () => {
          const result =
            safeText(
              reader.result
            );

          resolve(
            result.includes(',')
              ? result.split(',')[1]
              : result
          );
        };

        reader.onerror = reject;

        reader.readAsDataURL(file);
      }
    );
  }

  // ============================================================
  // EMOJIS
  // ============================================================

  const emojis = [
    '😀',
    '😂',
    '😍',
    '🥰',
    '😘',
    '😊',
    '😉',
    '😎',
    '🤩',
    '🥳',
    '😅',
    '🤣',
    '😭',
    '😢',
    '😡',
    '🤔',
    '😮',
    '😴',
    '🙏',
    '👏',
    '👍',
    '👎',
    '❤️',
    '💙',
    '💚',
    '💛',
    '🧡',
    '💜',
    '✨',
    '🔥',
    '🎉',
    '👓',
    '📱',
    '💬',
    '📞',
    '✅',
    '❌',
  ];

  function addEmoji(emoji) {
    setDraft(
      (prev) =>
        `${prev}${emoji}`
    );

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  // ============================================================
  // FILTRO
  // ============================================================

  const filteredContacts =
    contacts.filter((contact) => {
      if (!contact) {
        return false;
      }

      const name =
        safeText(contact.name);

      const phone =
        safeText(contact.phone);

      const text =
        `${name} ${phone}`
          .toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    });

  // ============================================================
  // HORÁRIO
  // ============================================================

  function formatTime(date) {
    if (!date) return '';

    try {
      const parsed =
        new Date(date);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return '';
      }

      return parsed.toLocaleTimeString(
        'pt-BR',
        {
          hour: '2-digit',
          minute: '2-digit',
        }
      );
    } catch {
      return '';
    }
  }

  // ============================================================
  // DATA
  // ============================================================

  function formatDate(date) {
    if (!date) return '';

    try {
      const parsed =
        new Date(date);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return '';
      }

      return parsed.toLocaleDateString(
        'pt-BR',
        {
          day: '2-digit',
          month: '2-digit',
        }
      );
    } catch {
      return '';
    }
  }

  // ============================================================
  // AVATAR
  // ============================================================

  function getInitial(contact) {
    if (!contact) {
      return '?';
    }

    const name =
      safeText(
        contact.name
      ).trim();

    const phone =
      safeText(
        contact.phone
      ).trim();

    const value =
      name || phone || '?';

    return value
      .charAt(0)
      .toUpperCase();
  }

  // ============================================================
  // ÚLTIMA MENSAGEM
  // ============================================================

  function getLastMessage(contact) {
    if (!contact) {
      return '';
    }

    const last =
      contact.last_message ??
      contact.lastMessage;

    if (
      last !== null &&
      last !== undefined &&
      last !== ''
    ) {
      return safeText(last);
    }

    return 'Nenhuma mensagem';
  }

  // ============================================================
  // STATUS
  // ============================================================

  function getStatusIcon(status) {
    const value =
      safeText(status)
        .toLowerCase();

    if (
      value === 'read' ||
      value === 'lido'
    ) {
      return '✓✓';
    }

    if (
      value === 'delivered' ||
      value === 'entregue'
    ) {
      return '✓✓';
    }

    if (
      value === 'failed' ||
      value === 'falhou'
    ) {
      return '!';
    }

    return '✓';
  }

  // ============================================================
  // MEDIA
  // ============================================================

  function getMediaType(message) {
    if (!message) {
      return '';
    }

    return safeText(
      message.media_mime
    ).toLowerCase();
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <div className="crm-app">

        {/* =====================================================
            SIDEBAR
        ===================================================== */}

        <aside className="main-sidebar">

          <div className="brand">

            <div className="brand-icon">
              💬
            </div>

            <div>
              <div className="brand-title">
                WhatsApp CRM
              </div>

              <div className="brand-subtitle">
                Atendimento
              </div>
            </div>

          </div>

          <nav className="main-menu">

            <Link
              href="/"
              className="menu-item active"
            >
              <span>💬</span>
              <span>Inbox</span>
            </Link>

            <Link
              href="/contacts"
              className="menu-item"
            >
              <span>👥</span>
              <span>
                Contatos &amp; Disparo
              </span>
            </Link>

          </nav>

          <div className="sidebar-bottom">

            <div className="connection-status">

              <span className="online-dot"></span>

              <div>
                <strong>
                  WhatsApp conectado
                </strong>

                <small>
                  Sistema online
                </small>
              </div>

            </div>

          </div>

        </aside>

        {/* =====================================================
            LISTA DE CONVERSAS
        ===================================================== */}

        <section className="conversation-panel">

          <div className="conversation-header">

            <div>
              <h1>Conversas</h1>

              <span>
                {contacts.length}{' '}
                {contacts.length === 1
                  ? 'conversa'
                  : 'conversas'}
              </span>
            </div>

          </div>

          <div className="search-box">

            <span className="search-icon">
              🔍
            </span>

            <input
              type="text"
              placeholder="Pesquisar conversa..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />

          </div>

          <div className="conversation-list">

            {filteredContacts.map(
              (contact, index) => {

                if (!contact) {
                  return null;
                }

                const contactId =
                  safeId(contact.id);

                const name =
                  safeText(
                    contact.name
                  );

                const phone =
                  safeText(
                    contact.phone
                  );

                const displayName =
                  name ||
                  phone ||
                  'Contato';

                return (
                  <button
                    key={
                      `${contactId || 'contato'}-${index}`
                    }
                    type="button"
                    className={`conversation-item ${
                      safeId(
                        selected?.id
                      ) ===
                      contactId
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      handleSelectContact(
                        contact
                      )
                    }
                  >

                    <div className="avatar">
                      {getInitial(
                        contact
                      )}
                    </div>

                    <div className="conversation-info">

                      <div className="conversation-top">

                        <strong>
                          {displayName}
                        </strong>

                        <span>
                          {formatDate(
                            contact.updated_at ||
                              contact.created_at
                          )}
                        </span>

                      </div>

                      <div className="conversation-bottom">

                        <span>
                          {getLastMessage(
                            contact
                          )}
                        </span>

                      </div>

                    </div>

                  </button>
                );
              }
            )}

            {filteredContacts.length ===
              0 && (

              <div className="empty-conversations">

                <div className="empty-icon">
                  💬
                </div>

                <strong>
                  Nenhuma conversa
                </strong>

                <span>
                  Quando alguém enviar
                  uma mensagem, ela
                  aparecerá aqui.
                </span>

              </div>

            )}

          </div>

        </section>

        {/* =====================================================
            CHAT
        ===================================================== */}

        <main className="chat">

          {!selected ? (

            <div className="empty-chat">

              <div className="empty-chat-icon">
                💬
              </div>

              <h2>
                WhatsApp CRM
              </h2>

              <p>
                Selecione uma conversa
                para começar o
                atendimento.
              </p>

            </div>

          ) : (

            <>

              {/* HEADER */}

              <header className="chat-header">

                <div className="chat-contact">

                  <div className="avatar large">
                    {getInitial(
                      selected
                    )}
                  </div>

                  <div>

                    <strong>
                      {safeText(
                        selected.name
                      ) ||
                        safeText(
                          selected.phone
                        ) ||
                        'Contato'}
                    </strong>

                    <span>
                      {safeText(
                        selected.phone
                      )}
                    </span>

                  </div>

                </div>

                <div className="chat-actions">

                  <button
                    type="button"
                    title="Pesquisar"
                  >
                    🔍
                  </button>

                  <button
                    type="button"
                    title="Mais opções"
                  >
                    ⋮
                  </button>

                </div>

              </header>

              {/* MENSAGENS */}

              <section className="messages">

                <div className="messages-background">

                  {messages.length ===
                    0 && (

                    <div className="no-messages">

                      <div>
                        🔒
                      </div>

                      <strong>
                        Nenhuma mensagem
                      </strong>

                      <span>
                        Esta conversa ainda
                        não possui mensagens.
                      </span>

                    </div>

                  )}

                  {messages.map(
                    (message, index) => {

                      if (!message) {
                        return null;
                      }

                      const isInbound =
                        safeText(
                          message.direction
                        ) ===
                        'inbound';

                      const mediaUrl =
                        safeText(
                          message.media_url
                        );

                      const mediaMime =
                        getMediaType(
                          message
                        );

                      const body =
                        safeText(
                          message.body
                        );

                      const hasImage =
                        mediaUrl &&
                        mediaMime.startsWith(
                          'image/'
                        );

                      const hasAudio =
                        mediaUrl &&
                        mediaMime.startsWith(
                          'audio/'
                        );

                      const hasVideo =
                        mediaUrl &&
                        mediaMime.startsWith(
                          'video/'
                        );

                      const hasDocument =
                        mediaUrl &&
                        (
                          mediaMime.startsWith(
                            'application/'
                          ) ||
                          mediaMime.includes(
                            'pdf'
                          )
                        );

                      return (

                        <div
                          key={
                            message.id ??
                            `message-${index}`
                          }
                          className={`message-row ${
                            isInbound
                              ? 'received'
                              : 'sent'
                          }`}
                        >

                          <div
                            className={`message-bubble ${
                              isInbound
                                ? 'received-bubble'
                                : 'sent-bubble'
                            }`}
                          >

                            {/* IMAGEM */}

                            {hasImage && (

                              <img
                                src={mediaUrl}
                                alt="Imagem recebida"
                                className="message-image"
                                onClick={() =>
                                  window.open(
                                    mediaUrl,
                                    '_blank'
                                  )
                                }
                              />

                            )}

                            {/* ÁUDIO */}

                            {hasAudio && (

                              <audio
                                controls
                                src={mediaUrl}
                                className="message-audio"
                              />

                            )}

                            {/* VÍDEO */}

                            {hasVideo && (

                              <video
                                controls
                                src={mediaUrl}
                                className="message-video"
                              />

                            )}

                            {/* DOCUMENTO */}

                            {hasDocument && (

                              <a
                                href={mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="document-message"
                              >
                                📄

                                <span>
                                  Abrir documento
                                </span>

                              </a>

                            )}

                            {/* TEXTO */}

                            {body && (

                              <div className="message-text">
                                {body}
                              </div>

                            )}

                            <div className="message-meta">

                              <span>
                                {formatTime(
                                  message.created_at
                                )}
                              </span>

                              {!isInbound && (

                                <span
                                  className={`message-status ${
                                    safeText(
                                      message.status
                                    ).toLowerCase() ===
                                      'read' ||
                                    safeText(
                                      message.status
                                    ).toLowerCase() ===
                                      'lido'
                                      ? 'read'
                                      : ''
                                  }`}
                                >
                                  {getStatusIcon(
                                    message.status
                                  )}
                                </span>

                              )}

                            </div>

                          </div>

                        </div>

                      );
                    }
                  )}

                  <div
                    ref={
                      messagesEndRef
                    }
                  />

                </div>

              </section>

              {/* COMPOSER */}

              <footer className="composer">

                {showEmoji && (

                  <div className="emoji-picker">

                    <div className="emoji-grid">

                      {emojis.map(
                        (emoji) => (

                          <button
                            key={emoji}
                            type="button"
                            onClick={() =>
                              addEmoji(
                                emoji
                              )
                            }
                          >
                            {emoji}
                          </button>

                        )
                      )}

                    </div>

                  </div>

                )}

                <button
                  type="button"
                  className="composer-button"
                  title="Emoji"
                  onClick={() =>
                    setShowEmoji(
                      (prev) =>
                        !prev
                    )
                  }
                >
                  😊
                </button>

                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) =>
                    setDraft(
                      e.target.value
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  placeholder="Digite uma mensagem"
                  rows={1}
                  disabled={sending}
                />

                <input
                  type="file"
                  accept="audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,.mp3,.ogg,.m4a,.amr"
                  ref={audioInputRef}
                  onChange={
                    handleAudioFileChange
                  }
                  style={{
                    display: 'none',
                  }}
                />

                {draft.trim() ? (

                  <button
                    type="button"
                    className="send-button"
                    onClick={
                      handleSend
                    }
                    disabled={
                      sending
                    }
                  >
                    {sending
                      ? '...'
                      : '➤'}
                  </button>

                ) : (

                  <button
                    type="button"
                    className="composer-button"
                    title="Enviar áudio"
                    onClick={() =>
                      audioInputRef.current?.click()
                    }
                    disabled={
                      sending
                    }
                  >
                    🎙️
                  </button>

                )}

              </footer>

            </>

          )}

        </main>

      </div>

      {/* =====================================================
          CSS
      ===================================================== */}

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .crm-app {
          display: grid;
          grid-template-columns: 220px 360px minmax(0, 1fr);
          height: 100vh;
          width: 100%;
          overflow: hidden;
          background: #f0f2f5;
          color: #111827;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Helvetica,
            Arial,
            sans-serif;
        }

        /* ================================
           MENU
        ================================= */

        .main-sidebar {
          display: flex;
          flex-direction: column;
          background: #0b5ed7;
          color: white;
          padding: 20px 14px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px 24px;
        }

        .brand-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          color: #0b5ed7;
          font-size: 20px;
        }

        .brand-title {
          font-size: 15px;
          font-weight: 700;
        }

        .brand-subtitle {
          font-size: 11px;
          color: rgba(255,255,255,.75);
          margin-top: 2px;
        }

        .main-menu {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .menu-item,
        .menu-item:visited,
        .menu-item:active {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 9px;
          color: #ffd400;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: .2s;
        }

        .menu-item:hover {
          background: rgba(255,255,255,.12);
          color: #fff;
        }

        .menu-item.active,
        .menu-item.active:visited {
          background: rgba(255,255,255,.15);
          color: #ffd400;
        }

        .sidebar-bottom {
          margin-top: auto;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border-radius: 10px;
          background: rgba(0,0,0,.12);
        }

        .online-dot {
          width: 9px;
          height: 9px;
          flex: 0 0 auto;
          background: #22c55e;
          border-radius: 50%;
        }

        .connection-status strong {
          display: block;
          font-size: 11px;
        }

        .connection-status small {
          display: block;
          margin-top: 2px;
          color: rgba(255,255,255,.7);
          font-size: 10px;
        }

        /* ================================
           LISTA
        ================================= */

        .conversation-panel {
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: white;
          border-right: 1px solid #e5e7eb;
        }

        .conversation-header {
          padding: 20px 18px 12px;
        }

        .conversation-header h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #111827;
        }

        .conversation-header span {
          display: block;
          margin-top: 4px;
          color: #6b7280;
          font-size: 12px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 14px 12px;
          padding: 0 12px;
          height: 40px;
          background: #f3f4f6;
          border-radius: 9px;
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          font-size: 13px;
          color: #111827;
        }

        .conversation-list {
          flex: 1;
          overflow-y: auto;
        }

        .conversation-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 15px;
          border: 0;
          border-bottom: 1px solid #f1f2f4;
          background: white;
          text-align: left;
          cursor: pointer;
          transition: background .15s;
          color: #111827;
        }

        .conversation-item:hover {
          background: #f8fafc;
        }

        .conversation-item.selected {
          background: #eef4ff;
        }

        .avatar {
          flex: 0 0 auto;
          width: 45px;
          height: 45px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 17px;
          font-weight: 700;
        }

        .avatar.large {
          width: 42px;
          height: 42px;
          font-size: 16px;
        }

        .conversation-info {
          min-width: 0;
          flex: 1;
        }

        .conversation-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .conversation-top strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          color: #111827;
          font-weight: 600;
        }

        .conversation-top span {
          flex: 0 0 auto;
          font-size: 10px;
          color: #9ca3af;
        }

        .conversation-bottom span {
          display: block;
          max-width: 100%;
          margin-top: 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #6b7280;
          font-size: 12px;
        }

        .empty-conversations {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 50px 25px;
          color: #6b7280;
        }

        .empty-icon {
          font-size: 35px;
          margin-bottom: 12px;
        }

        .empty-conversations strong {
          color: #374151;
          font-size: 14px;
        }

        .empty-conversations span {
          margin-top: 6px;
          line-height: 1.5;
          font-size: 12px;
        }

        /* ================================
           CHAT
        ================================= */

        .chat {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          position: relative;
          background: #efeae2;
        }

        .chat-header {
          height: 68px;
          flex: 0 0 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          z-index: 5;
        }

        .chat-contact {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .chat-contact strong {
          display: block;
          font-size: 14px;
          color: #111827;
        }

        .chat-contact span {
          display: block;
          margin-top: 2px;
          color: #6b7280;
          font-size: 11px;
        }

        .chat-actions {
          display: flex;
          gap: 5px;
        }

        .chat-actions button {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
          font-size: 16px;
        }

        .chat-actions button:hover {
          background: #f3f4f6;
        }

        .messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        .messages-background {
          min-height: 100%;
          padding: 25px 7%;
          background-color: #efeae2;
          background-image:
            radial-gradient(
              rgba(120,113,108,.08) 1px,
              transparent 1px
            );
          background-size: 18px 18px;
        }

        .message-row {
          display: flex;
          margin-bottom: 5px;
        }

        .message-row.received {
          justify-content: flex-start;
        }

        .message-row.sent {
          justify-content: flex-end;
        }

        .message-bubble {
          position: relative;
          max-width: min(65%, 600px);
          padding: 8px 10px 6px;
          border-radius: 9px;
          box-shadow: 0 1px 1px rgba(0,0,0,.06);
        }

        .received-bubble {
          background: white;
          border-top-left-radius: 3px;
        }

        .sent-bubble {
          background: #d9fdd3;
          border-top-right-radius: 3px;
        }

        .message-text {
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 14px;
          line-height: 1.45;
          padding-right: 35px;
          color: #111827;
        }

        .message-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 3px;
          color: #8696a0;
          font-size: 9px;
        }

        .message-status {
          font-size: 12px;
          letter-spacing: -3px;
          color: #8696a0;
        }

        .message-status.read {
          color: #53bdeb;
        }

        .message-image {
          display: block;
          max-width: 320px;
          max-height: 400px;
          border-radius: 7px;
          cursor: pointer;
        }

        .message-audio {
          width: 280px;
          max-width: 100%;
        }

        .message-video {
          display: block;
          width: 320px;
          max-width: 100%;
          border-radius: 7px;
        }

        .document-message {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 190px;
          padding: 8px;
          border-radius: 7px;
          background: rgba(0,0,0,.04);
          color: #111827;
          text-decoration: none;
          font-size: 13px;
        }

        .no-messages {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: fit-content;
          max-width: 280px;
          margin: 80px auto;
          padding: 16px 22px;
          border-radius: 10px;
          background: rgba(255,255,255,.85);
          text-align: center;
          color: #6b7280;
          box-shadow: 0 1px 2px rgba(0,0,0,.05);
        }

        .no-messages > div {
          font-size: 25px;
          margin-bottom: 8px;
        }

        .no-messages strong {
          color: #374151;
          font-size: 13px;
        }

        .no-messages span {
          margin-top: 5px;
          font-size: 11px;
        }

        /* ================================
           COMPOSER
        ================================= */

        .composer {
          position: relative;
          flex: 0 0 auto;
          display: flex;
          align-items: flex-end;
          gap: 7px;
          padding: 10px 14px;
          background: #f0f2f5;
          border-top: 1px solid #dfe3e6;
        }

        .composer textarea {
          flex: 1;
          min-height: 42px;
          max-height: 120px;
          resize: none;
          border: 0;
          outline: 0;
          border-radius: 9px;
          padding: 12px 14px;
          background: white;
          color: #111827;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.3;
        }

        .composer textarea::placeholder {
          color: #9ca3af;
        }

        .composer-button,
        .send-button {
          flex: 0 0 auto;
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          cursor: pointer;
          font-size: 19px;
        }

        .composer-button:hover {
          background: #e1e5e8;
        }

        .send-button {
          background: #0b5ed7;
          color: white;
          font-size: 18px;
        }

        .send-button:hover {
          background: #084db2;
        }

        .composer-button:disabled,
        .send-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        /* ================================
           EMOJIS
        ================================= */

        .emoji-picker {
          position: absolute;
          bottom: 62px;
          left: 10px;
          width: 310px;
          padding: 12px;
          border-radius: 12px;
          background: white;
          box-shadow: 0 10px 35px rgba(0,0,0,.18);
          z-index: 20;
        }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 3px;
        }

        .emoji-grid button {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          font-size: 21px;
        }

        .emoji-grid button:hover {
          background: #f3f4f6;
        }

        /* ================================
           TELA INICIAL
        ================================= */

        .empty-chat {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #6b7280;
        }

        .empty-chat-icon {
          width: 75px;
          height: 75px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #dbeafe;
          font-size: 34px;
          margin-bottom: 15px;
        }

        .empty-chat h2 {
          margin: 0;
          color: #374151;
          font-size: 20px;
        }

        .empty-chat p {
          max-width: 350px;
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.5;
        }

        /* ================================
           RESPONSIVO
        ================================= */

        @media (max-width: 1000px) {

          .crm-app {
            grid-template-columns:
              75px
              320px
              minmax(0, 1fr);
          }

          .brand {
            justify-content: center;
          }

          .brand > div:last-child {
            display: none;
          }

          .menu-item {
            justify-content: center;
          }

          .menu-item span:last-child {
            display: none;
          }

          .connection-status div {
            display: none;
          }

          .connection-status {
            justify-content: center;
          }

        }

        @media (max-width: 750px) {

          .crm-app {
            grid-template-columns: 1fr;
          }

          .main-sidebar {
            display: none;
          }

          .conversation-panel {
            display: none;
          }

          .chat {
            width: 100%;
          }

          .message-bubble {
            max-width: 82%;
          }

          .messages-background {
            padding: 20px 12px;
          }

        }

      `}</style>
    </>
  );
}