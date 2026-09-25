import { useEffect, useMemo, useState } from 'react';

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case 'template':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M7 8h10" />
          <path d="M7 12h7" />
          <path d="M7 16h5" />
        </svg>
      );

    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      );

    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 11a8.1 8.1 0 0 0-14.9-4L3 10" />
          <path d="M3 4v6h6" />
          <path d="M4 13a8.1 8.1 0 0 0 14.9 4L21 14" />
          <path d="M21 20v-6h-6" />
        </svg>
      );

    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case 'send':
      return (
        <svg {...common}>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      );

    case 'file':
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h6" />
        </svg>
      );

    case 'chevron':
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );

    case 'x':
      return (
        <svg {...common}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );

    case 'home':
      return (
        <svg {...common}>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v11h14V9" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );

    case 'campaign':
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
          <path d="M8 17h3" />
        </svg>
      );

    default:
      return null;
  }
}

function getInitials(name, phone) {
  const value = String(name || phone || '').trim();

  if (!value) return '?';

  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}

function formatDate(value) {
  if (!value) return 'Sem atividade';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Sem atividade';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getTemplateBody(template) {
  if (!template?.components) return '';

  const body = template.components.find(
    (component) => component.type === 'BODY'
  );

  return body?.text || '';
}

function getVariableNumbers(text) {
  const matches = String(text || '').match(/{{\s*(\d+)\s*}}/g) || [];

  return [...new Set(
    matches.map((match) =>
      Number(match.replace(/[{}]/g, '').trim())
    )
  )].sort((a, b) => a - b);
}

function formatTemplatePreview(text, mappings) {
  let result = String(text || '');

  Object.entries(mappings || {}).forEach(([number, mapping]) => {
    let value = `{{${number}}}`;

    if (mapping?.source === 'contact.name') {
      value = 'Nome do contato';
    }

    if (mapping?.source === 'contact.phone') {
      value = 'Telefone';
    }

    if (mapping?.source === 'static') {
      value = mapping.value || `{{${number}}}`;
    }

    result = result.replace(
      new RegExp(`{{\\s*${number}\\s*}}`, 'g'),
      value
    );
  });

  return result;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [selectedIds, setSelectedIds] = useState(new Set());

  const [search, setSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);

  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [mappings, setMappings] = useState({});

  const [campaignName, setCampaignName] = useState('');

  const [processing, setProcessing] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [campaignError, setCampaignError] = useState('');

  async function loadContacts() {
    try {
      setLoadingContacts(true);

      const response = await fetch('/api/contacts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar contatos');
      }

      setContacts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingContacts(false);
    }
  }

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);

      const response = await fetch('/api/whatsapp/templates');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar templates');
      }

      setTemplates(data.templates || []);
    } catch (error) {
      console.error(error);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    loadContacts();
    loadTemplates();
  }, []);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return contacts;
    }

    return contacts.filter((contact) => {
      return (
        String(contact.name || '')
          .toLowerCase()
          .includes(term) ||
        String(contact.phone || '')
          .toLowerCase()
          .includes(term)
      );
    });
  }, [contacts, search]);

  const selectedCount = selectedIds.size;

  const selectedTemplateBody = getTemplateBody(selectedTemplate);

  const templateVariables = getVariableNumbers(
    selectedTemplateBody
  );

  const previewText = formatTemplatePreview(
    selectedTemplateBody,
    mappings
  );

  function toggleContact(id) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);

      filteredContacts.forEach((contact) => {
        next.add(contact.id);
      });

      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      setCsvText(String(loadEvent.target?.result || ''));
    };

    reader.readAsText(file, 'UTF-8');
  }

  async function importCsv() {
    if (!csvText.trim()) {
      setImportResult({
        type: 'error',
        message: 'Selecione um arquivo CSV ou cole o conteúdo da lista.',
      });
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);

      const response = await fetch('/api/contacts/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao importar lista');
      }

      const importedIds = Array.isArray(data.contact_ids)
        ? data.contact_ids
        : [];

      setSelectedIds(new Set(importedIds));

      setImportResult({
        type: 'success',
        message: `${importedIds.length} contatos foram selecionados para esta campanha.`,
        data,
      });

      await loadContacts();
    } catch (error) {
      setImportResult({
        type: 'error',
        message: error.message,
      });
    } finally {
      setImporting(false);
    }
  }

  function selectTemplate(template) {
    setSelectedTemplate(template);

    const body = getTemplateBody(template);
    const variables = getVariableNumbers(body);

    const initialMappings = {};

    variables.forEach((number, index) => {
      initialMappings[number] = {
        source: index === 0 ? 'contact.name' : 'static',
        value: '',
      };
    });

    setMappings(initialMappings);
  }

  function updateMapping(number, field, value) {
    setMappings((current) => ({
      ...current,
      [number]: {
        ...(current[number] || {}),
        [field]: value,
      },
    }));
  }

  function buildTemplateComponents() {
    if (!templateVariables.length) {
      return [];
    }

    return [
      {
        type: 'body',
        parameters: templateVariables.map((number) => ({
          source: mappings[number]?.source || 'static',
          value: mappings[number]?.value || '',
        })),
      },
    ];
  }

  async function runBatches(campaignId) {
    let finished = false;

    while (!finished) {
      const response = await fetch('/api/send/bulk-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          batch_size: 10,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Erro durante o processamento da campanha'
        );
      }

      setCampaign((current) => ({
        ...(current || {}),
        ...data,
      }));

      finished = Boolean(data.done);
    }
  }

  async function handleStartCampaign() {
    setCampaignError('');

    if (!selectedCount) {
      setCampaignError(
        'Selecione pelo menos um contato para iniciar o disparo.'
      );
      return;
    }

    if (!selectedTemplate) {
      setCampaignError(
        'Selecione um template aprovado antes de iniciar o disparo.'
      );
      return;
    }

    try {
      setProcessing(true);

      const response = await fetch('/api/send/bulk-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: campaignName.trim() || undefined,
          template_name: selectedTemplate.name,
          template_lang: selectedTemplate.language || 'pt_BR',
          template_components: buildTemplateComponents(),
          contact_ids: [...selectedIds],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Não foi possível iniciar a campanha.'
        );
      }

      setCampaign(data);

      await runBatches(data.id);
    } catch (error) {
      setCampaignError(error.message);
    } finally {
      setProcessing(false);
    }
  }

  const campaignTotal = Number(
    campaign?.total_contacts || selectedCount || 0
  );

  const campaignSent = Number(campaign?.sent_total || 0);
  const campaignFailed = Number(campaign?.failed_total || 0);

  const campaignProcessed =
    campaignSent + campaignFailed;

  const progress =
    campaignTotal > 0
      ? Math.min(
          100,
          Math.round(
            (campaignProcessed / campaignTotal) * 100
          )
        )
      : 0;

  const campaignStatus =
    campaign?.status === 'done'
      ? 'Concluída'
      : processing
        ? 'Em andamento'
        : 'Pronta';

  return (
    <div className="contacts-layout">
      <aside className="contacts-sidebar">
        <div className="contacts-brand">
          <div className="contacts-brand-mark">M</div>

          <div>
            <strong>Mercadótica</strong>
            <span>WhatsApp CRM</span>
          </div>
        </div>

        <div className="contacts-nav-label">
          Workspace
        </div>

        <nav className="contacts-nav">
          <a href="/" className="contacts-nav-item">
            <Icon name="home" size={18} />
            <span>Inbox</span>
          </a>

          <a
            href="/contacts"
            className="contacts-nav-item active"
          >
            <Icon name="users" size={18} />
            <span>Contatos & Disparos</span>
          </a>
        </nav>

        <div className="contacts-sidebar-footer">
          <div className="connection-indicator">
            <span className="connection-dot" />
            <div>
              <strong>WhatsApp conectado</strong>
              <small>Operação ativa</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="contacts-main">
        <header className="contacts-header">
          <div>
            <div className="contacts-eyebrow">
              WhatsApp Business
            </div>

            <h1>Contatos & Disparos</h1>

            <p>
              Crie campanhas direcionadas usando seus templates aprovados.
            </p>
          </div>

          <button
            type="button"
            className="contacts-refresh-button"
            onClick={() => {
              loadContacts();
              loadTemplates();
            }}
          >
            <Icon name="refresh" size={17} />
            Atualizar
          </button>
        </header>

        <section className="contacts-stats">
          <div className="contacts-stat-card">
            <div className="stat-icon">
              <Icon name="users" size={19} />
            </div>

            <div>
              <span>Total de contatos</span>
              <strong>{contacts.length}</strong>
            </div>
          </div>

          <div className="contacts-stat-card">
            <div className="stat-icon selected">
              <Icon name="check" size={19} />
            </div>

            <div>
              <span>Selecionados</span>
              <strong>{selectedCount}</strong>
            </div>
          </div>

          <div className="contacts-stat-card">
            <div className="stat-icon">
              <Icon name="template" size={19} />
            </div>

            <div>
              <span>Templates aprovados</span>
              <strong>{templates.length}</strong>
            </div>
          </div>

          <div className="contacts-stat-card">
            <div className="stat-icon">
              <Icon name="send" size={19} />
            </div>

            <div>
              <span>Status</span>
              <strong>{campaignStatus}</strong>
            </div>
          </div>
        </section>

        <div className="campaign-stepper">
          <div className="step active">
            <span>01</span>
            <div>
              <strong>Público</strong>
              <small>Escolha os contatos</small>
            </div>
          </div>

          <div className="step-line" />

          <div
            className={`step ${
              selectedTemplate ? 'active' : ''
            }`}
          >
            <span>02</span>
            <div>
              <strong>Template</strong>
              <small>Configure a mensagem</small>
            </div>
          </div>

          <div className="step-line" />

          <div
            className={`step ${
              campaign ? 'active' : ''
            }`}
          >
            <span>03</span>
            <div>
              <strong>Envio</strong>
              <small>Acompanhe a campanha</small>
            </div>
          </div>
        </div>

        <section className="crm-card audience-card">
          <div className="card-header">
            <div>
              <div className="card-kicker">
                Etapa 01
              </div>

              <h2>Defina o público</h2>

              <p>
                Importe uma lista CSV para selecionar automaticamente
                os contatos que receberão a campanha.
              </p>
            </div>

            <div className="selected-badge">
              {selectedCount} selecionados
            </div>
          </div>

          <div className="import-layout">
            <label className="upload-zone">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
              />

              <div className="upload-icon">
                <Icon name="upload" size={24} />
              </div>

              <strong>
                {fileName || 'Selecione um arquivo CSV'}
              </strong>

              <span>
                Colunas esperadas: nome e telefone
              </span>

              <small>
                Clique para escolher o arquivo
              </small>
            </label>

            <div className="import-details">
              <div className="import-details-title">
                Lista de contatos
              </div>

              <textarea
                value={csvText}
                onChange={(event) =>
                  setCsvText(event.target.value)
                }
                placeholder={
                  'nome,telefone\nMaria,5577999999999\nJoão,5577988888888'
                }
              />

              <div className="import-actions">
                <span>
                  {csvText.trim()
                    ? 'Conteúdo pronto para importação'
                    : 'Nenhum arquivo selecionado'}
                </span>

                <button
                  type="button"
                  className="primary-button"
                  onClick={importCsv}
                  disabled={importing || !csvText.trim()}
                >
                  {importing
                    ? 'Importando...'
                    : 'Importar lista'}
                </button>
              </div>
            </div>
          </div>

          {importResult && (
            <div
              className={`import-result ${
                importResult.type
              }`}
            >
              <div>
                <strong>
                  {importResult.type === 'success'
                    ? 'Importação concluída'
                    : 'Não foi possível importar'}
                </strong>

                <span>{importResult.message}</span>
              </div>

              <button
                type="button"
                onClick={() => setImportResult(null)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          )}
        </section>

        <section className="crm-card template-section">
          <div className="card-header">
            <div>
              <div className="card-kicker">
                Etapa 02
              </div>

              <h2>Escolha o template</h2>

              <p>
                Selecione um template aprovado pela Meta para realizar
                o disparo.
              </p>
            </div>

            <div className="template-count">
              {templates.length} aprovados
            </div>
          </div>

          {loadingTemplates ? (
            <div className="empty-state">
              <div className="loading-spinner" />
              <span>Carregando templates...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="empty-state">
              <Icon name="template" size={28} />
              <strong>Nenhum template aprovado encontrado</strong>
              <span>
                Verifique os templates cadastrados na sua conta da Meta.
              </span>
            </div>
          ) : (
            <div className="template-grid">
              {templates.map((template) => {
                const isSelected =
                  selectedTemplate?.name === template.name &&
                  selectedTemplate?.language === template.language;

                const body = getTemplateBody(template);

                return (
                  <button
                    type="button"
                    key={`${template.name}-${template.language}`}
                    className={`template-card ${
                      isSelected ? 'selected' : ''
                    }`}
                    onClick={() => selectTemplate(template)}
                  >
                    <div className="template-card-top">
                      <div className="template-status">
                        <span />
                        Aprovado
                      </div>

                      {isSelected && (
                        <div className="template-check">
                          <Icon name="check" size={15} />
                        </div>
                      )}
                    </div>

                    <strong className="template-name">
                      {template.name}
                    </strong>

                    <div className="template-meta">
                      <span>
                        {template.language || 'pt_BR'}
                      </span>

                      {template.category && (
                        <span>
                          {template.category}
                        </span>
                      )}
                    </div>

                    <div className="template-preview-text">
                      {body || 'Template sem conteúdo de corpo.'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedTemplate && (
          <section className="crm-card configuration-section">
            <div className="card-header">
              <div>
                <div className="card-kicker">
                  Configuração
                </div>

                <h2>
                  {selectedTemplate.name}
                </h2>

                <p>
                  Configure as variáveis e veja como a mensagem será
                  apresentada.
                </p>
              </div>

              <div className="language-badge">
                {selectedTemplate.language || 'pt_BR'}
              </div>
            </div>

            <div className="configuration-grid">
              <div className="variables-panel">
                <div className="panel-title">
                  Variáveis da mensagem
                </div>

                {templateVariables.length === 0 ? (
                  <div className="no-variables">
                    Este template não possui variáveis no corpo.
                  </div>
                ) : (
                  <div className="variables-list">
                    {templateVariables.map((number) => (
                      <div
                        className="variable-row"
                        key={number}
                      >
                        <div className="variable-number">
                          {`{{${number}}}`}
                        </div>

                        <div className="variable-fields">
                          <label>
                            Fonte
                            <select
                              value={
                                mappings[number]?.source ||
                                'static'
                              }
                              onChange={(event) =>
                                updateMapping(
                                  number,
                                  'source',
                                  event.target.value
                                )
                              }
                            >
                              <option value="contact.name">
                                Nome do contato
                              </option>

                              <option value="contact.phone">
                                Telefone
                              </option>

                              <option value="static">
                                Valor fixo
                              </option>
                            </select>
                          </label>

                          {mappings[number]?.source === 'static' && (
                            <label>
                              Valor
                              <input
                                type="text"
                                value={
                                  mappings[number]?.value || ''
                                }
                                onChange={(event) =>
                                  updateMapping(
                                    number,
                                    'value',
                                    event.target.value
                                  )
                                }
                                placeholder="Digite o valor"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="preview-panel">
                <div className="panel-title">
                  Prévia da mensagem
                </div>

                <div className="whatsapp-preview">
                  <div className="preview-header">
                    <div className="preview-avatar">
                      M
                    </div>

                    <div>
                      <strong>Mercadótica</strong>
                      <span>Conta comercial</span>
                    </div>
                  </div>

                  <div className="preview-body">
                    <div className="message-bubble">
                      {previewText || selectedTemplateBody}
                      <span className="message-time">
                        10:42
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="crm-card campaign-card">
          <div className="card-header">
            <div>
              <div className="card-kicker">
                Etapa 03
              </div>

              <h2>Preparar disparo</h2>

              <p>
                Revise as informações antes de iniciar a campanha.
              </p>
            </div>
          </div>

          <div className="campaign-form">
            <label>
              Nome da campanha
              <input
                type="text"
                value={campaignName}
                onChange={(event) =>
                  setCampaignName(event.target.value)
                }
                placeholder="Ex.: Campanha de setembro"
              />
            </label>
          </div>

          <div className="campaign-summary">
            <div>
              <span>Público</span>
              <strong>
                {selectedCount} contatos
              </strong>
            </div>

            <div>
              <span>Template</span>
              <strong>
                {selectedTemplate
                  ? selectedTemplate.name
                  : 'Nenhum selecionado'}
              </strong>
            </div>

            <div>
              <span>Idioma</span>
              <strong>
                {selectedTemplate?.language || '—'}
              </strong>
            </div>

            <button
              type="button"
              className="send-button"
              onClick={handleStartCampaign}
              disabled={
                processing ||
                !selectedCount ||
                !selectedTemplate
              }
            >
              <Icon name="send" size={17} />

              {processing
                ? 'Enviando...'
                : 'Iniciar disparo'}
            </button>
          </div>

          {campaignError && (
            <div className="campaign-error">
              {campaignError}
            </div>
          )}
        </section>

        {campaign && (
          <section className="crm-card progress-card">
            <div className="progress-header">
              <div>
                <div className="card-kicker">
                  Acompanhamento
                </div>

                <h2>Progresso da campanha</h2>
              </div>

              <span className={`campaign-status ${campaign.status}`}>
                {campaign.status === 'done'
                  ? 'Concluída'
                  : processing
                    ? 'Em andamento'
                    : 'Pronta'}
              </span>
            </div>

            <div className="progress-value">
              <strong>{progress}%</strong>
              <span>
                {campaignProcessed} de {campaignTotal} processados
              </span>
            </div>

            <div className="progress-bar">
              <div
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="progress-stats">
              <div>
                <span>Enviados</span>
                <strong>{campaignSent}</strong>
              </div>

              <div>
                <span>Falhas</span>
                <strong>{campaignFailed}</strong>
              </div>

              <div>
                <span>Restantes</span>
                <strong>
                  {Math.max(
                    0,
                    campaignTotal - campaignProcessed
                  )}
                </strong>
              </div>
            </div>
          </section>
        )}

        <section className="crm-card contacts-section">
          <button
            type="button"
            className="contacts-section-toggle"
            onClick={() =>
              setShowContacts((current) => !current)
            }
          >
            <div className="contacts-section-title">
              <div className="section-icon">
                <Icon name="users" size={19} />
              </div>

              <div>
                <strong>Contatos da campanha</strong>
                <span>
                  {selectedCount} contatos selecionados
                </span>
              </div>
            </div>

            <Icon
              name="chevron"
              size={19}
            />
          </button>

          {showContacts && (
            <div className="contacts-drawer">
              <div className="contacts-drawer-toolbar">
                <div className="contacts-search">
                  <Icon name="search" size={17} />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Buscar por nome ou telefone..."
                  />
                </div>

                <div className="drawer-actions">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                  >
                    Selecionar exibidos
                  </button>

                  <button
                    type="button"
                    onClick={clearSelection}
                  >
                    Limpar seleção
                  </button>
                </div>
              </div>

              {loadingContacts ? (
                <div className="contacts-loading">
                  <div className="loading-spinner" />
                  Carregando contatos...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="contacts-empty">
                  Nenhum contato encontrado.
                </div>
              ) : (
                <div className="contacts-table">
                  <div className="contacts-table-head">
                    <span />
                    <span>Contato</span>
                    <span>Telefone</span>
                    <span>Última atividade</span>
                  </div>

                  {filteredContacts.map((contact) => {
                    const selected = selectedIds.has(contact.id);

                    return (
                      <button
                        type="button"
                        className={`contact-row ${
                          selected ? 'selected' : ''
                        }`}
                        key={contact.id}
                        onClick={() =>
                          toggleContact(contact.id)
                        }
                      >
                        <span className="contact-checkbox">
                          {selected && (
                            <Icon name="check" size={13} />
                          )}
                        </span>

                        <span className="contact-person">
                          <span className="contact-avatar">
                            {getInitials(
                              contact.name,
                              contact.phone
                            )}
                          </span>

                          <span>
                            <strong>
                              {contact.name || 'Sem nome'}
                            </strong>

                            <small>
                              ID #{contact.id}
                            </small>
                          </span>
                        </span>

                        <span className="contact-phone">
                          {contact.phone}
                        </span>

                        <span className="contact-date">
                          {formatDate(
                            contact.last_message_at
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}