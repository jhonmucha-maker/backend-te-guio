// Exportacion a Excel / PDF de las entidades administrables.
//
// Que datos trae cada entidad y con que columnas se define UNA sola vez en
// utils/datasets. Aqui solo se resuelve el transporte HTTP: que se pide,
// en que formato, y el envio del archivo.
//
//   GET /admin/export/:entity?format=xlsx|pdf   -> una entidad
//   GET /admin/export/bundle?entities=a,b&format=xlsx|pdf -> exportacion general
//
// El formato se decide con ?format=xlsx|pdf (default xlsx).

const { DATASETS, DATASET_KEYS } = require('../utils/datasets');
const { sendExport, sendExportBundle } = require('../utils/exporters');

const resolveFormat = (req) =>
  String(req.query.format || '').toLowerCase() === 'pdf' ? 'pdf' : 'xlsx';

// Si el archivo ya empezo a enviarse, un res.status().json() reventaria con
// ERR_HTTP_HEADERS_SENT y ocultaria el error real: solo queda cortar.
const failExport = (res, error, msg) => {
  console.error(msg, error);
  if (res.headersSent) return res.end();
  return res.status(500).json({ error: msg });
};

// ==================== UNA ENTIDAD ====================
// Handler generico: /admin/export/:entity
const exportEntity = async (req, res) => {
  const key = String(req.params.entity || '');
  const dataset = DATASETS[key];

  if (!dataset) {
    return res.status(404).json({
      error: `Entidad no exportable: ${key}`,
      disponibles: DATASET_KEYS,
    });
  }

  try {
    const { columns, rows } = await dataset.fetch();
    await sendExport(res, {
      format: resolveFormat(req),
      filename: dataset.filename,
      title: dataset.label,
      columns,
      rows,
    });
  } catch (error) {
    return failExport(res, error, `Error al exportar ${dataset.label.toLowerCase()}`);
  }
};

// ==================== EXPORTACION GENERAL ====================
// /admin/export/bundle?entities=buyers,stores&format=xlsx|pdf
// Sin ?entities se exportan todas. Un solo archivo: Excel multi-hoja o PDF
// con una seccion por entidad.
const exportBundle = async (req, res) => {
  const raw = String(req.query.entities || '').trim();
  const requested = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DATASET_KEYS;

  const invalid = requested.filter((k) => !DATASETS[k]);
  if (invalid.length) {
    return res.status(400).json({
      error: `Entidades no exportables: ${invalid.join(', ')}`,
      disponibles: DATASET_KEYS,
    });
  }
  if (!requested.length) {
    return res.status(400).json({ error: 'Selecciona al menos una entidad' });
  }

  // Se respeta el orden del registro, no el orden en que llegaron los params:
  // asi el archivo sale siempre igual.
  const keys = DATASET_KEYS.filter((k) => requested.includes(k));

  try {
    // Secuencial a proposito: en paralelo, 7 findMany sin paginar competirian
    // por el pool de conexiones y multiplicarian el pico de memoria.
    const sections = [];
    for (const key of keys) {
      const { columns, rows } = await DATASETS[key].fetch();
      sections.push({ title: DATASETS[key].sheet, columns, rows });
    }

    await sendExportBundle(res, {
      format: resolveFormat(req),
      filename: 'marketplace',
      title: 'Exportación general',
      sections,
    });
  } catch (error) {
    return failExport(res, error, 'Error al generar la exportación general');
  }
};

// ==================== CATALOGO ====================
// Alimenta la pantalla de exportacion general: que se puede exportar.
const getExportCatalog = async (req, res) => {
  res.json({
    entidades: DATASET_KEYS.map((key) => ({ key, label: DATASETS[key].label })),
  });
};

module.exports = { exportEntity, exportBundle, getExportCatalog };
