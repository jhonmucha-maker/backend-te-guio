// Utilidad compartida de exportacion a Excel (.xlsx) y PDF.
//
// Uso: sendExport(res, { format, filename, title, columns, rows })
//   - format:  'xlsx' | 'pdf'  (cualquier otro valor -> xlsx por defecto)
//   - filename: nombre base del archivo, SIN extension (ej: 'compradores')
//   - title:   titulo mostrado en el PDF y nombre de la hoja del Excel
//   - columns: [{ header, key, width?, pdfWidth? }]
//       header  -> texto de la cabecera
//       key     -> propiedad correspondiente en cada objeto de `rows`
//       width   -> ancho de columna en Excel (caracteres)
//       pdfWidth-> ancho de columna en PDF ('auto' | '*' | numero). Default '*'
//   - rows:    array de objetos { [key]: valor }
//
// Centraliza todo el armado de archivos: cada controlador solo define
// columnas + filas y delega aqui, evitando duplicar boilerplate por entidad.

const ExcelJS = require('exceljs');

// Color de marca reutilizado en cabeceras (mismo morado del export de vendedores).
const BRAND_HEX = '4A44A8';

// ── PDF: inicializacion perezosa del printer (pdfmake, server-side) ──
// Se inicializa una sola vez y solo si se solicita un PDF, para no cargar
// las fuentes en memoria cuando solo se exporta Excel.
let _printer = null;
function getPrinter() {
  if (_printer) return _printer;
  const PdfPrinter = require('pdfmake');
  const vfsMod = require('pdfmake/build/vfs_fonts');
  // La forma del modulo vfs varia entre versiones de pdfmake; resolvemos las tres.
  const vfs = vfsMod.vfs || (vfsMod.pdfMake && vfsMod.pdfMake.vfs) || vfsMod;
  const fonts = {
    Roboto: {
      normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
      bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
      italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
      bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
    },
  };
  _printer = new PdfPrinter(fonts);
  return _printer;
}

// Convierte cualquier valor a texto seguro para la celda.
function toText(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

// Anade una hoja ya formateada al workbook. Compartido por la exportacion
// individual (1 hoja) y la general (N hojas).
function addSheet(workbook, { title, columns, rows }) {
  // ExcelJS corta los nombres de hoja en 31 caracteres.
  const sheet = workbook.addWorksheet((title || 'Datos').substring(0, 31));
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || 20,
  }));

  // Estilo de cabecera (fila 1).
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND_HEX } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  rows.forEach((r) => {
    const normalized = {};
    columns.forEach((c) => { normalized[c.key] = toText(r[c.key]); });
    const row = sheet.addRow(normalized);
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  return sheet;
}

function newWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Marketplace Admin';
  workbook.created = new Date();
  return workbook;
}

async function buildExcel({ title, columns, rows }) {
  const workbook = newWorkbook();
  addSheet(workbook, { title, columns, rows });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Excel con una hoja por entidad.
// sections: [{ title, columns, rows }]
async function buildExcelMulti(sections) {
  const workbook = newWorkbook();
  sections.forEach((s) => addSheet(workbook, s));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const TABLE_LAYOUT = {
  fillColor: (rowIndex) => {
    if (rowIndex === 0) return '#' + BRAND_HEX;
    return rowIndex % 2 === 0 ? '#F3F3FA' : null;
  },
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#DDDDDD',
  vLineColor: () => '#DDDDDD',
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

const PDF_STYLES = {
  docTitle: { fontSize: 18, bold: true, color: '#' + BRAND_HEX, margin: [0, 0, 0, 2] },
  title: { fontSize: 15, bold: true, color: '#' + BRAND_HEX, margin: [0, 0, 0, 2] },
  subtitle: { fontSize: 8, color: '#888888', margin: [0, 0, 0, 10] },
  th: { fontSize: 8, bold: true, color: '#FFFFFF' },
  td: { fontSize: 8, color: '#333333' },
};

// Bloques pdfmake de una seccion: titulo + subtitulo + tabla.
// pageBreak inicia la seccion en una pagina nueva (usado desde la 2a en adelante).
function pdfSection({ title, columns, rows }, { pageBreak = false } = {}) {
  const body = [
    columns.map((c) => ({ text: c.header, style: 'th' })),
    ...rows.map((r) => columns.map((c) => ({ text: toText(r[c.key]), style: 'td' }))),
  ];

  const head = { text: title, style: 'title' };
  if (pageBreak) head.pageBreak = 'before';

  return [
    head,
    { text: `${rows.length} registro(s)`, style: 'subtitle' },
    {
      table: { headerRows: 1, widths: columns.map((c) => c.pdfWidth || '*'), body },
      layout: TABLE_LAYOUT,
    },
  ];
}

function renderPdf(docDefinition) {
  const printer = getPrinter();
  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (c) => chunks.push(c));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

const pdfBase = (content) => ({
  pageSize: 'A4',
  pageOrientation: 'landscape',
  pageMargins: [20, 42, 20, 30],
  content,
  styles: PDF_STYLES,
  defaultStyle: { font: 'Roboto' },
  footer: (currentPage, pageCount) => ({
    text: `${currentPage} / ${pageCount}`,
    alignment: 'center',
    fontSize: 7,
    color: '#999999',
    margin: [0, 8, 0, 0],
  }),
});

function buildPdf({ title, columns, rows }) {
  return renderPdf(pdfBase([
    { text: title, style: 'title' },
    {
      text: `Generado: ${new Date().toLocaleString('es-PE')}  ·  ${rows.length} registro(s)`,
      style: 'subtitle',
    },
    {
      table: { headerRows: 1, widths: columns.map((c) => c.pdfWidth || '*'), body: [
        columns.map((c) => ({ text: c.header, style: 'th' })),
        ...rows.map((r) => columns.map((c) => ({ text: toText(r[c.key]), style: 'td' }))),
      ] },
      layout: TABLE_LAYOUT,
    },
  ]));
}

// PDF unico con una seccion por entidad, cada una en su propia pagina.
// sections: [{ title, columns, rows }]
function buildPdfMulti(sections, { title }) {
  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  const content = [
    { text: title, style: 'docTitle' },
    {
      text: `Generado: ${new Date().toLocaleString('es-PE')}  ·  ${sections.length} sección(es)  ·  ${total} registro(s)`,
      style: 'subtitle',
    },
    ...sections.flatMap((s, i) => pdfSection(s, { pageBreak: i > 0 })),
  ];
  return renderPdf(pdfBase(content));
}

const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Fecha local en el nombre del archivo, para que descargas sucesivas no se
// acumulen como "productos (1).xlsx", "productos (2).xlsx"...
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Escribe el buffer con las cabeceras correctas. El filename va entrecomillado
// porque ahora puede contener caracteres no-ASCII (ej: "galerias" esta bien,
// pero un label con tilde no lo estaria).
function sendBuffer(res, buffer, filename, ext) {
  res.setHeader('Content-Type', MIME[ext]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${stamp()}.${ext}"`);
  return res.end(buffer);
}

// Genera y envia el archivo de UNA entidad.
async function sendExport(res, { format, filename, title, columns, rows }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (format === 'pdf') {
    const buffer = await buildPdf({ title, columns, rows: safeRows });
    return sendBuffer(res, buffer, filename, 'pdf');
  }

  // Por defecto: Excel .xlsx
  const buffer = await buildExcel({ title, columns, rows: safeRows });
  return sendBuffer(res, buffer, filename, 'xlsx');
}

// Genera y envia UN archivo con varias entidades:
//   xlsx -> una hoja por entidad
//   pdf  -> una seccion por entidad, cada una en pagina nueva
async function sendExportBundle(res, { format, filename, title, sections }) {
  const safe = (sections || []).map((s) => ({
    ...s,
    rows: Array.isArray(s.rows) ? s.rows : [],
  }));

  if (format === 'pdf') {
    const buffer = await buildPdfMulti(safe, { title });
    return sendBuffer(res, buffer, filename, 'pdf');
  }

  const buffer = await buildExcelMulti(safe);
  return sendBuffer(res, buffer, filename, 'xlsx');
}

module.exports = { sendExport, sendExportBundle };
