export async function sendTemplateMessage(
  toPhone,
  templateName,
  languageCode = 'pt_BR',
  components = []
) {
  const template = {
    name: templateName,
    language: {
      code: languageCode,
    },
  };

  if (
    Array.isArray(components) &&
    components.length > 0
  ) {
    template.components =
      components;
  }

  return callGraphApi({
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template,
  });
}