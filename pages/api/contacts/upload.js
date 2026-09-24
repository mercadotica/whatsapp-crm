import Papa from 'papaparse';
import { getOrCreateContact } from '../../../lib/db';

// Espera um body JSON: { csvText: "nome,telefone\nJoão,5577999999999\n..." }
// O CSV precisa ter cabeçalho com colunas "nome" (ou "name") e "telefone" (ou "phone")
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { csvText } = req.body;
  if (!csvText) return res.status(400).json({ error: 'csvText é obrigatório' });

  const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    return res.status(400).json({ error: 'Erro ao ler CSV', details: parsed.errors });
  }

  const results = { created: 0, duplicates: 0, failed: [] };
  const seenInFile = new Set();

  for (const row of parsed.data) {
    const name = row.nome || row.name || row.Nome || row.Name;
    const phone = row.telefone || row.phone || row.Telefone || row.Phone;

    if (!phone) {
      results.failed.push({ row, reason: 'sem telefone' });
      continue;
    }

    const cleanPhone = String(phone).replace(/\D/g, '');

    try {
      const contact = await getOrCreateContact({ name, phone });

      // Duplicado dentro do próprio arquivo (mesmo telefone repetido no CSV)
      // ou já existente no banco de antes.
      if (contact._duplicate || seenInFile.has(cleanPhone)) {
        results.duplicates++;
      } else {
        results.created++;
      }

      seenInFile.add(cleanPhone);
    } catch (err) {
      results.failed.push({ row, reason: err.message });
    }
  }

  return res.status(200).json(results);
}
