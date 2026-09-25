import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

function getTemplateBody(template) {
  return (
    template?.components?.find((component) => component.type === 'BODY')?.text ||
    ''
  );
}

function getVariableNumbers(text) {
  const numbers = [];
  const regex = /{{\s*(\d+)\s*}}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const number = Number(match[1]);

    if (!numbers.includes(number)) {
      numbers.push(number);
    }
  }

  return numbers.sort((a, b) => a - b);
}

function formatTemplatePreview(text, mappings, contact) {
  if (!text) return '';

  return text.replace(/{{\s*(\d+)\s*}}/g, (_, rawNumber) => {
    const number = Number(rawNumber);
    const mapping = mappings[number];

    if (!mapping) {
      return `{{${number}}}`;
    }

    if (mapping.source === 'contact.name') {
      return contact?.name || 'Nome do cliente';
    }

    if (mapping.source === 'contact.phone') {
      return contact?.phone || 'Telefone';
    }

    if (mapping.source === 'static') {
      return mapping.value || `{{${number}}}`;
    }

    return `{{${number}}}`;
  });
}

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loadState, setLoadState] = useState('loading');

  const [selectedIds, setSelectedIds] = useState(new Set());

  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [templatesState, setTemplatesState] = useState('loading');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variableMappings, setVariableMappings] = useState({});

  const [search, setSearch] = useState('');

  const [campaign, setCampaign] = useState(null);
  const [campaignError, setCampaignError] = useState('');
  const [processing, setProcessing] = useState(false);

  async function loadContacts() {
    setLoadState('loading');

    try {
      const res = await fetch('/api/contacts');

      if (!res.ok) {
        throw new Error('Falha ao carregar contatos');
      }

      const data = await res.json();

      setContacts(Array.isArray(data) ? data : []);
      setLoadState('ready');
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
      setLoadState('error');
    }
  }

  async function loadTemplates() {
    setTemplatesState('loading');

    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'Falha ao carregar templates'
        );
      }

      setTemplates(
        Array.isArray(data.templates)
          ? data.templates
          : []
      );

      setTemplatesState('ready');
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
      setTemplatesState('error');
    }
  }

  useEffect(() => {
    loadContacts();
    loadTemplates();
  }, []);

  useEffect(() => {
    const template = templates.find(
      (item) =>
        `${item.name}:${item.language}` ===
        selectedTemplateName
    );

    setSelectedTemplate(template || null);

    if (template) {
      const variables = getVariableNumbers(
        getTemplateBody(template)
      );

      const defaults = {};

      variables.forEach((number, index) => {
        defaults[number] = {
          source:
            index === 0
              ? 'contact.name'
              : 'static',
          value: '',
        };
      });

      setVariableMappings(defaults);
    } else {
      setVariableMappings({});
    }
  }, [selectedTemplateName, templates]);

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

  const selectedContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        selectedIds.has(contact.id)
      ),
    [contacts, selectedIds]
  );

  const templateVariables = useMemo(
    () =>
      getVariableNumbers(
        getTemplateBody(selectedTemplate)
      ),
    [selectedTemplate]
  );

  const previewContact =
    selectedContacts[0] ||
    contacts[0] ||
    null;

  const previewText = useMemo(
    () =>
      formatTemplatePreview(
        getTemplateBody(selectedTemplate),
        variableMappings,
        previewContact
      ),
    [
      selectedTemplate,
      variableMappings,
      previewContact,
    ]
  );

  function toggleSelect(id) {
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

    const reader = new FileReader();

    reader.onload = (loadedEvent) => {
      setCsvText(
        String(
          loadedEvent.target?.result || ''
        )
      );
    };

    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText.trim()) {
      setImportResult({
        error:
          'Selecione um CSV ou cole o conteúdo da lista primeiro.',
      });

      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch(
        '/api/contacts/upload',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            csvText,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setImportResult({
          error:
            data.error ||
            'Erro ao importar lista',
        });

        return;
      }

      setImportResult(data);
      setCsvText('');

      const importedIds =
        Array.isArray(data.contact_ids)
          ? data.contact_ids
          : [];

      // IMPORTANTE:
      // os contatos da lista importada
      // ficam selecionados automaticamente.
      setSelectedIds(
        new Set(importedIds)
      );

      await loadContacts();
    } catch (err) {
      console.error(
        'Erro ao importar CSV:',
        err
      );

      setImportResult({
        error:
          'Erro de conexão ao importar a lista. Tente novamente.',
      });
    } finally {
      setImporting(false);
    }
  }

  function updateVariableMapping(
    number,
    field,
    value
  ) {
    setVariableMappings((current) => ({
      ...current,

      [number]: {
        ...(current[number] || {}),
        [field]: value,
      },
    }));
  }

  function buildTemplateComponents() {
    if (
      !selectedTemplate ||
      templateVariables.length === 0
    ) {
      return [];
    }

    return [
      {
        type: 'body',

        parameters:
          templateVariables.map((number) => {
            const mapping =
              variableMappings[number];

            return {
              type: 'text',
              source:
                mapping?.source ||
                'static',
              value:
                mapping?.value || '',
            };
          }),
      },
    ];
  }

  function validateCampaign() {
    if (selectedIds.size === 0) {
      return 'Selecione pelo menos um contato para o disparo.';
    }

    if (!selectedTemplate) {
      return 'Selecione um template aprovado da Meta.';
    }

    for (const number of templateVariables) {
      const mapping =
        variableMappings[number];

      if (!mapping?.source) {
        return `Defina o valor da variável {{${number}}}.`;
      }

      if (
        mapping.source === 'static' &&
        !mapping.value?.trim()
      ) {
        return `Preencha o valor fixo da variável {{${number}}}.`;
      }
    }

    return '';
  }

  async function handleStartCampaign() {
    const validationError =
      validateCampaign();

    setCampaignError(
      validationError
    );

    if (validationError) return;

    const contactIds =
      Array.from(selectedIds);

    const templateComponents =
      buildTemplateComponents();

    setProcessing(true);
    setCampaign(null);

    try {
      const res = await fetch(
        '/api/send/bulk-start',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: `Campanha ${selectedTemplate.name} - ${new Date().toLocaleString('pt-BR')}`,
            template_name:
              selectedTemplate.name,
            template_lang:
              selectedTemplate.language ||
              'pt_BR',
            template_components:
              templateComponents,
            contact_ids:
              contactIds,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setCampaignError(
          data.error ||
            'Erro ao iniciar campanha'
        );

        return;
      }

      setCampaign(data);
      setCampaignError('');

      runBatches(
        data.id,
        data.total_contacts
      );
    } catch (err) {
      console.error(
        'Erro ao iniciar campanha:',
        err
      );

      setCampaignError(
        'Erro de conexão ao iniciar a campanha.'
      );
    } finally {
      setProcessing(false);
    }
  }

  async function runBatches(
    campaignId,
    total
  ) {
    setProcessing(true);

    let done = false;

    try {
      while (!done) {
        const res = await fetch(
          '/api/send/bulk-process',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              campaign_id:
                campaignId,
              batch_size: 10,
            }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          setCampaignError(
            data.error ||
              'Erro ao processar lote de envio'
          );

          setCampaign((prev) => ({
            ...prev,
            status: 'failed',
          }));

          return;
        }

        done = Boolean(data.done);

        setCampaign((prev) => ({
          ...prev,

          sent_count:
            data.sent_total ??
            ((prev?.sent_count || 0) +
              (data.sent || 0)),

          failed_count:
            data.failed_total ??
            ((prev?.failed_count || 0) +
              (data.failed || 0)),

          total_contacts: total,

          status: done
            ? 'done'
            : 'running',
        }));
      }
    } catch (err) {
      console.error(
        'Erro ao processar campanha:',
        err
      );

      setCampaignError(
        'A conexão caiu durante o envio. O disparo em produção deve evoluir para uma fila persistente.'
      );

      setCampaign((prev) => ({
        ...prev,
        status: 'failed',
      }));
    } finally {
      setProcessing(false);
    }
  }

  const progressPct =
    campaign?.total_contacts
      ? Math.min(
          100,
          Math.round(
            (((campaign.sent_count ||
              0) +
              (campaign.failed_count ||
                0)) /
              campaign.total_contacts) *
              100
          )
        )
      : 0;

  return (
    <div className="layout">
      <nav className="sidebar">
        <h2>WhatsApp CRM</h2>

        <Link href="/">
          Inbox
        </Link>

        <Link href="/contacts">
          Contatos &amp; Disparo
        </Link>
      </nav>

      <main className="content contacts-page">
        <div className="page-header">
          <div>
            <span className="eyebrow">
              WhatsApp Business
            </span>

            <h1>
              Contatos &amp; Disparos
            </h1>

            <p>
              Importe uma lista, escolha um
              template aprovado e envie somente
              para os contatos selecionados.
            </p>
          </div>
        </div>

        <section className="card campaign-steps">
          <div className="step active">
            <span>1</span>

            <div>
              <strong>Público</strong>
              <small>
                {selectedIds.size}{' '}
                selecionado(s)
              </small>
            </div>
          </div>

          <div className="step">
            <span>2</span>

            <div>
              <strong>Template</strong>

              <small>
                {selectedTemplate
                  ? selectedTemplate.name
                  : 'Não selecionado'}
              </small>
            </div>
          </div>

          <div className="step">
            <span>3</span>

            <div>
              <strong>Disparo</strong>

              <small>
                {campaign
                  ? campaign.status
                  : 'Aguardando'}
              </small>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <div>
              <h2>
                1. Importar lista
              </h2>

              <p>
                O CRM selecionará
                automaticamente os contatos
                dessa importação para o próximo
                disparo.
              </p>
            </div>
          </div>

          <div className="import-grid">
            <div>
              <input
                className="file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={
                  handleFileUpload
                }
              />

              <textarea
                className="csv-box"
                placeholder={
                  'nome,telefone\nMaria,5577999999999\nJoão,5577988888888'
                }
                value={csvText}
                onChange={(event) =>
                  setCsvText(
                    event.target.value
                  )
                }
              />

              <button
                onClick={handleImport}
                disabled={importing}
              >
                {importing
                  ? 'Importando...'
                  : 'Importar lista'}
              </button>
            </div>

            <div className="info-box">
              <strong>
                Como funciona
              </strong>

              <ul>
                <li>
                  Use as colunas{' '}
                  <code>
                    nome
                  </code>{' '}
                  e{' '}
                  <code>
                    telefone
                  </code>.
                </li>

                <li>
                  Telefones devem estar com
                  DDI.
                </li>

                <li>
                  Contatos que já existem
                  continuam sendo incluídos
                  na lista atual.
                </li>

                <li>
                  Depois da importação, a
                  seleção fica pronta
                  automaticamente.
                </li>
              </ul>
            </div>
          </div>

          {importResult && (
            <div
              className={`state-banner ${
                importResult.error
                  ? 'state-error'
                  : 'state-success'
              }`}
            >
              {importResult.error ? (
                importResult.error
              ) : (
                <>
                  <strong>
                    {importResult.created}
                  </strong>{' '}
                  novo(s) contato(s)
                  importado(s).

                  {importResult.duplicates >
                    0 &&
                    ` ${importResult.duplicates} já existia(m).`}

                  {importResult.failed
                    ?.length > 0 &&
                    ` ${importResult.failed.length} linha(s) não puderam ser importadas.`}

                  <br />

                  <strong>
                    {importResult.contact_ids
                      ?.length || 0}
                  </strong>{' '}
                  contato(s) foram
                  selecionados para o
                  disparo.
                </>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-title">
            <div>
              <h2>
                2. Escolher público
              </h2>

              <p>
                Você controla exatamente quem
                receberá a campanha.
              </p>
            </div>

            <div className="selection-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={
                  selectAllFiltered
                }
              >
                Selecionar exibidos
              </button>

              <button
                type="button"
                className="button-secondary"
                onClick={
                  clearSelection
                }
              >
                Limpar seleção
              </button>
            </div>
          </div>

          <div className="contacts-toolbar">
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            <div className="selected-counter">
              <strong>
                {selectedIds.size}
              </strong>{' '}
              selecionado(s)
            </div>
          </div>

          {loadState === 'loading' && (
            <div className="state-banner">
              Carregando contatos...
            </div>
          )}

          {loadState === 'error' && (
            <div className="state-banner state-error">
              Não foi possível carregar os
              contatos.

              <button
                type="button"
                className="button-secondary"
                onClick={
                  loadContacts
                }
              >
                Tentar novamente
              </button>
            </div>
          )}

          {loadState === 'ready' &&
            contacts.length === 0 && (
              <div className="state-banner">
                Nenhum contato cadastrado.
                Importe uma lista acima para
                começar.
              </div>
            )}

          {loadState === 'ready' &&
            contacts.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="checkbox-cell">
                        #
                      </th>
                      <th>Nome</th>
                      <th>Telefone</th>
                      <th>
                        Última mensagem
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredContacts.map(
                      (contact) => (
                        <tr
                          key={
                            contact.id
                          }
                          className={
                            selectedIds.has(
                              contact.id
                            )
                              ? 'selected-row'
                              : ''
                          }
                        >
                          <td className="checkbox-cell">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(
                                contact.id
                              )}
                              onChange={() =>
                                toggleSelect(
                                  contact.id
                                )
                              }
                            />
                          </td>

                          <td>
                            <strong>
                              {contact.name ||
                                'Sem nome'}
                            </strong>
                          </td>

                          <td>
                            {contact.phone ||
                              '—'}
                          </td>

                          <td>
                            {contact.last_message_at
                              ? new Date(
                                  contact.last_message_at
                                ).toLocaleString(
                                  'pt-BR'
                                )
                              : '—'}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
        </section>

        <section className="card">
          <div className="section-title">
            <div>
              <h2>
                3. Template aprovado
              </h2>

              <p>
                Os templates abaixo vêm da
                conta do WhatsApp Business
                configurada no CRM.
              </p>
            </div>

            <button
              type="button"
              className="button-secondary"
              onClick={
                loadTemplates
              }
            >
              Atualizar templates
            </button>
          </div>

          {templatesState ===
            'loading' && (
            <div className="state-banner">
              Carregando templates
              aprovados...
            </div>
          )}

          {templatesState ===
            'error' && (
            <div className="state-banner state-error">
              Não foi possível carregar os
              templates. Verifique o token e
              o ID da conta do WhatsApp
              Business.
            </div>
          )}

          {templatesState ===
            'ready' &&
            templates.length === 0 && (
              <div className="state-banner">
                Nenhum template aprovado foi
                encontrado na conta.
              </div>
            )}

          {templatesState ===
            'ready' &&
            templates.length > 0 && (
              <div className="template-grid">
                {templates.map(
                  (template) => {
                    const key = `${template.name}:${template.language}`;

                    const isSelected =
                      selectedTemplateName ===
                      key;

                    const body =
                      getTemplateBody(
                        template
                      );

                    return (
                      <button
                        type="button"
                        key={key}
                        className={`template-card ${
                          isSelected
                            ? 'template-card-selected'
                            : ''
                        }`}
                        onClick={() =>
                          setSelectedTemplateName(
                            key
                          )
                        }
                      >
                        <div className="template-card-top">
                          <strong>
                            {
                              template.name
                            }
                          </strong>

                          <span>
                            {
                              template.language
                            }
                          </span>
                        </div>

                        <p>
                          {body ||
                            'Template sem texto no corpo.'}
                        </p>
                      </button>
                    );
                  }
                )}
              </div>
            )}

          {selectedTemplate && (
            <div className="template-editor">
              <div className="template-editor-header">
                <div>
                  <span className="eyebrow">
                    Template selecionado
                  </span>

                  <h3>
                    {
                      selectedTemplate.name
                    }
                  </h3>
                </div>

                <span className="approved-badge">
                  APROVADO
                </span>
              </div>

              {templateVariables.length >
                0 && (
                <div className="variables-area">
                  <h4>
                    Variáveis do template
                  </h4>

                  <p>
                    Defina de onde cada
                    variável será preenchida.
                  </p>

                  {templateVariables.map(
                    (number) => {
                      const mapping =
                        variableMappings[
                          number
                        ] || {};

                      return (
                        <div
                          className="variable-row"
                          key={number}
                        >
                          <div className="variable-label">
                            {`{{${number}}}`}
                          </div>

                          <select
                            value={
                              mapping.source ||
                              ''
                            }
                            onChange={(
                              event
                            ) =>
                              updateVariableMapping(
                                number,
                                'source',
                                event
                                  .target
                                  .value
                              )
                            }
                          >
                            <option value="">
                              Selecione...
                            </option>

                            <option value="contact.name">
                              Nome do contato
                            </option>

                            <option value="contact.phone">
                              Telefone
                            </option>

                            <option value="static">
                              Valor fixo para
                              todos
                            </option>
                          </select>

                          {mapping.source ===
                            'static' && (
                            <input
                              type="text"
                              placeholder="Digite o valor"
                              value={
                                mapping.value ||
                                ''
                              }
                              onChange={(
                                event
                              ) =>
                                updateVariableMapping(
                                  number,
                                  'value',
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}

              <div className="preview-box">
                <span>
                  Prévia
                </span>

                <div className="whatsapp-preview">
                  {previewText ||
                    getTemplateBody(
                      selectedTemplate
                    ) ||
                    'Sem conteúdo de texto.'}
                </div>

                {previewContact && (
                  <small>
                    Prévia usando:{' '}
                    {previewContact.name ||
                      previewContact.phone}
                  </small>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="card campaign-action-card">
          <div>
            <span className="eyebrow">
              Resumo do disparo
            </span>

            <h2>
              Pronto para enviar?
            </h2>

            <p>
              <strong>
                {selectedIds.size}
              </strong>{' '}
              contato(s) receberão o
              template{' '}
              <strong>
                {selectedTemplate?.name ||
                  '—'}
              </strong>
              .
            </p>
          </div>

          <button
            type="button"
            className="primary-large"
            onClick={
              handleStartCampaign
            }
            disabled={
              processing ||
              selectedIds.size === 0 ||
              !selectedTemplate
            }
          >
            {processing
              ? 'Enviando...'
              : 'Iniciar disparo'}
          </button>
        </section>

        {campaignError && (
          <div className="state-banner state-error">
            {campaignError}
          </div>
        )}

        {campaign && (
          <section className="card campaign-progress">
            <div className="progress-header">
              <div>
                <span className="eyebrow">
                  Campanha
                </span>

                <h3>
                  {campaign.name}
                </h3>
              </div>

              <strong>
                {campaign.status ===
                'done'
                  ? 'Concluído'
                  : campaign.status ===
                      'failed'
                    ? 'Interrompido'
                    : 'Enviando'}
              </strong>
            </div>

            <div className="progress-numbers">
              <span>
                <strong>
                  {campaign.sent_count ||
                    0}
                </strong>{' '}
                enviados
              </span>

              <span>
                <strong>
                  {campaign.failed_count ||
                    0}
                </strong>{' '}
                falharam
              </span>

              <span>
                <strong>
                  {campaign.total_contacts ||
                    0}
                </strong>{' '}
                total
              </span>
            </div>

            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progressPct}%`,
                }}
              />
            </div>

            <small>
              {progressPct}% processado
            </small>
          </section>
        )}
      </main>
    </div>
  );
}