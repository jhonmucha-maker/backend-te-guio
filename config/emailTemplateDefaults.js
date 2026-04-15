// ============================================================
// Plantillas HTML de email — Te Guío Marketplace
// Diseño premium: gradiente profundo, dígitos individuales,
// table-safe para todos los clientes de email
// ============================================================

const C = {
  outer: '#f5f4fa',
  card: '#ffffff',
  footer: '#faf9fe',
  primary: '#312c85',
  dark: '#1e1a5e',
  mid: '#4a3fb8',
  light: '#6c63ff',
  accent: '#4ECDC4',
  text: '#2d2d4e',
  body: '#4a4a68',
  muted: '#8a8aa3',
  faint: '#b0b0c4',
  line: '#eeedf5',
  font: "'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
};

// ─── Shared helpers ──────────────────────────────────────────

const greeting = (nameVar) =>
  `<p style="margin:0 0 14px;font-size:15px;color:${C.body};line-height:1.7;">Hola <strong style="color:${C.primary};">{{${nameVar}}}</strong>,</p>`;

const para = (text) =>
  `<p style="margin:0 0 20px;font-size:15px;color:${C.body};line-height:1.7;">${text}</p>`;

const infoBox = (html) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="background:#f0effa;border-left:4px solid ${C.primary};border-radius:0 10px 10px 0;padding:14px 16px;"><p style="margin:0;font-size:13px;color:${C.body};line-height:1.6;">${html}</p></td></tr></table>`;

const successBox = (html) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:#ecfdf5;border-left:4px solid #059669;border-radius:0 10px 10px 0;padding:16px;"><p style="margin:0;font-size:14px;font-weight:600;color:#065f46;">${html}</p></td></tr></table>`;

const warningBox = (html) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="background:#fffbeb;border-left:4px solid #d97706;border-radius:0 10px 10px 0;padding:16px;">${html}</td></tr></table>`;

// Fila de 6 dígitos individuales para código de verificación
const digitRow = (() => {
  const s = `bgcolor="${C.primary}" style="width:36px;height:44px;text-align:center;vertical-align:middle;font-size:22px;font-weight:800;color:#ffffff;font-family:'Courier New',Consolas,monospace;border-radius:10px;"`;
  const g = `<td width="5"></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:20px auto 24px;"><tr><td ${s}>{{d1}}</td>${g}<td ${s}>{{d2}}</td>${g}<td ${s}>{{d3}}</td>${g}<td ${s}>{{d4}}</td>${g}<td ${s}>{{d5}}</td>${g}<td ${s}>{{d6}}</td></tr></table>`;
})();

// Botón CTA (bulletproof: bgcolor en td para Outlook)
const ctaButton = (text, linkVar) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 24px;"><tr><td bgcolor="${C.primary}" style="border-radius:12px;box-shadow:0 4px 14px rgba(30,26,94,0.25);"><a href="{{${linkVar}}}" target="_blank" style="display:inline-block;padding:16px 40px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">${text}</a></td></tr></table>`;

// ─── Sample data for preview ──────────────────────────────────
const SAMPLE_DATA = {
  nombre: 'Juan P\u00e9rez',
  codigo: '482916',
  d1: '4', d2: '8', d3: '2', d4: '9', d5: '1', d6: '6',
  minutos: '15',
  link: 'https://teguio.com/reset/abc123',
  horas: '24',
  tienda: 'Mi Tienda Ejemplo',
  fecha_vencimiento: '25/03/2026',
  storeName: 'Mi Tienda Ejemplo',
  sellerName: 'Juan P\u00e9rez',
  logo_url: '/api/catalog/files/assets/logo.png',
  logo_display: 'block',
};

// ─── Sections metadata per template ───────────────────────────
// Content is PLAIN TEXT only — no HTML tags. buildHtmlFromSections() applies formatting.
const TEMPLATE_SECTIONS = {
  VERIFICACION_EMAIL: {
    emoji: '\ud83d\udee1\ufe0f',
    title: 'Verificaci\u00f3n de Cuenta',
    sections: [
      { key: 'greeting', label: 'Saludo', type: 'greeting', content: '', editable: false, nameVar: 'nombre' },
      { key: 'main_text', label: 'Mensaje principal', type: 'paragraph', content: 'Gracias por registrarte en Te Gu\u00edo. Usa este c\u00f3digo para verificar tu cuenta:', editable: true },
      { key: 'digit_row', label: 'C\u00f3digo de verificaci\u00f3n', type: 'digitRow', content: '', editable: false },
      { key: 'info_note', label: 'Nota informativa', type: 'infoBox', content: 'Este c\u00f3digo expira en {{minutos}} minutos. Si no creaste una cuenta, ignora este correo.', editable: true },
    ],
  },
  RECUPERACION_CONTRASENA: {
    emoji: '\ud83d\udd12',
    title: 'Restablecer Contrase\u00f1a',
    sections: [
      { key: 'greeting', label: 'Saludo', type: 'greeting', content: '', editable: false, nameVar: 'nombre' },
      { key: 'main_text', label: 'Mensaje principal', type: 'paragraph', content: 'Recibimos una solicitud para restablecer tu contrase\u00f1a. Haz clic en el bot\u00f3n para crear una nueva:', editable: true },
      { key: 'cta_button', label: 'Texto del bot\u00f3n', type: 'ctaButton', content: 'Restablecer Contrase\u00f1a', editable: true, linkVar: 'link' },
      { key: 'info_note', label: 'Nota informativa', type: 'infoBox', content: 'Este enlace expira en {{horas}} hora(s). Si no solicitaste este cambio, ignora este correo.', editable: true },
      { key: 'fallback_text', label: 'Texto alternativo', type: 'paragraph', content: 'Si el bot\u00f3n no funciona, copia y pega esta URL:', editable: true },
    ],
  },
  SUSCRIPCION_POR_VENCER: {
    emoji: '\u26a0\ufe0f',
    title: 'Suscripci\u00f3n por Vencer',
    sections: [
      { key: 'greeting', label: 'Saludo', type: 'greeting', content: '', editable: false, nameVar: 'nombre' },
      { key: 'main_text', label: 'Mensaje principal', type: 'paragraph', content: 'Te informamos que la suscripci\u00f3n de tu tienda est\u00e1 pr\u00f3xima a vencer:', editable: true },
      { key: 'warning_box', label: 'Alerta de tienda', type: 'warningBox', content: '', editable: false },
      { key: 'secondary_text', label: 'Mensaje secundario', type: 'paragraph', content: 'Renueva tu suscripci\u00f3n para mantener tu tienda visible y seguir vendiendo en la plataforma.', editable: true },
      { key: 'info_note', label: 'Nota informativa', type: 'infoBox', content: 'Ingresa a la app y dir\u00edgete a Suscripciones para renovar.', editable: true },
    ],
  },
  APROBACION_TIENDA: {
    emoji: '\u2705',
    title: '\u00a1Tienda Aprobada!',
    sections: [
      { key: 'greeting', label: 'Saludo', type: 'greeting', content: '', editable: false, nameVar: 'sellerName' },
      { key: 'main_text', label: 'Mensaje principal', type: 'paragraph', content: '\u00a1Excelentes noticias! Tu tienda ha sido aprobada exitosamente:', editable: true },
      { key: 'success_box', label: 'Confirmaci\u00f3n', type: 'successBox', content: '\ud83c\udfea {{storeName}}', editable: false },
      { key: 'secondary_text', label: 'Mensaje secundario', type: 'paragraph', content: 'Ya puedes comenzar a agregar productos y vender en nuestra plataforma. \u00a1Te deseamos mucho \u00e9xito!', editable: true },
      { key: 'info_note', label: 'Nota informativa', type: 'infoBox', content: 'Siguiente paso: Agrega tus productos desde la secci\u00f3n Mis Productos en la app.', editable: true },
    ],
  },
  APROBACION_VENDEDOR: {
    emoji: '\ud83c\udf89',
    title: '\u00a1Bienvenido a Te Gu\u00edo!',
    sections: [
      { key: 'greeting', label: 'Saludo', type: 'greeting', content: '', editable: false, nameVar: 'sellerName' },
      { key: 'main_text', label: 'Mensaje principal', type: 'paragraph', content: '\u00a1Felicitaciones! Tu solicitud como vendedor ha sido aprobada exitosamente. Ya eres parte de la comunidad de vendedores de Te Gu\u00edo.', editable: true },
      { key: 'success_box', label: 'Confirmaci\u00f3n', type: 'successBox', content: '\u2713 Cuenta de vendedor activada', editable: false },
      { key: 'secondary_text', label: 'Mensaje secundario', type: 'paragraph', content: 'Ahora puedes crear tu tienda y comenzar a vender en nuestra plataforma.', editable: true },
      { key: 'info_note', label: 'Nota informativa', type: 'infoBox', content: 'Siguiente paso: Crea tu primera tienda desde la app y solicita su aprobaci\u00f3n.', editable: true },
    ],
  },
};

// ─── Helper: auto-format plain text for HTML email ────────────
// Wraps {{variables}} in bold+primary color for infoBox sections
function formatInfoBoxContent(text) {
  // Bold any {{variable}} patterns
  let html = text.replace(/\{\{(\w+)\}\}/g, `<strong style="color:${C.primary};">{{$1}}</strong>`);
  return html;
}

// ─── Build HTML from sections ─────────────────────────────────
function buildHtmlFromSections(templateName, sections) {
  const tmplMeta = TEMPLATE_SECTIONS[templateName];
  if (!tmplMeta) throw new Error(`Template "${templateName}" not found in TEMPLATE_SECTIONS`);

  const bodyParts = sections.map((section) => {
    switch (section.type) {
      case 'greeting':
        return greeting(section.nameVar || 'nombre');
      case 'paragraph':
        return para(section.content);
      case 'infoBox':
        return infoBox(formatInfoBoxContent(section.content));
      case 'successBox':
        return successBox(section.content);
      case 'warningBox': {
        if (templateName === 'SUSCRIPCION_POR_VENCER') {
          return warningBox(`<p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#92400e;">\ud83c\udfea {{tienda}}</p><p style="margin:0;font-size:13px;color:#92400e;">Vence: <strong>{{fecha_vencimiento}}</strong></p>`);
        }
        return warningBox(section.content);
      }
      case 'digitRow':
        return digitRow;
      case 'ctaButton':
        return ctaButton(section.content, section.linkVar || 'link');
      default:
        return '';
    }
  });

  // For RECUPERACION_CONTRASENA, the last paragraph (fallback URL) has special styling
  if (templateName === 'RECUPERACION_CONTRASENA' && sections.length >= 5) {
    const fallbackSection = sections[sections.length - 1];
    if (fallbackSection.key === 'fallback_text') {
      bodyParts[bodyParts.length - 1] =
        `<p style="margin:12px 0 0;font-size:12px;color:${C.muted};">${fallbackSection.content}</p>` +
        `<p style="margin:4px 0 0;font-size:11px;color:${C.mid};word-break:break-all;">{{link}}</p>`;
    }
  }

  return wrap(tmplMeta.emoji, tmplMeta.title, bodyParts.join(''));
}

// ─── Wrapper ─────────────────────────────────────────────────

const wrap = (emoji, title, bodyHtml) =>
  `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>` +
  `<body style="margin:0;padding:0;background:${C.outer};font-family:${C.font};-webkit-font-smoothing:antialiased;">` +

  // Outer table
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.outer};padding:40px 16px;"><tr><td align="center">` +

  // Card
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border-radius:20px;overflow:hidden;box-shadow:0 2px 24px rgba(30,26,94,0.08);">` +

  // Header con gradiente y logo
  `<tr><td align="center" bgcolor="${C.primary}" style="background:linear-gradient(135deg,${C.dark} 0%,${C.primary} 50%,${C.mid} 100%);padding:44px 32px 36px;">` +
  `<img src="{{logo_url}}" alt="Te Gu\u00edo" width="72" height="72" style="display:{{logo_display}};width:72px;height:72px;object-fit:contain;margin:0 auto 16px;border-radius:16px;background:#ffffff;padding:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);" />` +
  `<h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">Te Gu\u00edo</h1>` +
  `<p style="margin:8px 0 0;font-size:11px;font-weight:600;color:rgba(255,255,255,0.45);letter-spacing:0.5px;">Encuentra tus productos con facilidad y confianza.</p>` +
  `</td></tr>` +

  // Barra de acento teal
  `<tr><td bgcolor="${C.accent}" style="height:4px;font-size:0;line-height:0;background:linear-gradient(90deg,${C.accent},${C.light},${C.accent});">&nbsp;</td></tr>` +

  // Sección: icono + título + línea decorativa
  `<tr><td style="padding:28px 32px 0;text-align:center;">` +
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td style="width:48px;height:48px;font-size:24px;line-height:48px;text-align:center;background:linear-gradient(135deg,rgba(78,205,196,0.15),rgba(49,44,133,0.1));border-radius:14px;">${emoji}</td></tr></table>` +
  `<h2 style="margin:12px 0 0;font-size:18px;font-weight:700;color:${C.text};letter-spacing:-0.3px;">${title}</h2>` +
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:12px auto 0;"><tr><td style="width:40px;height:3px;background:${C.accent};border-radius:2px;"></td></tr></table>` +
  `</td></tr>` +

  // Body
  `<tr><td style="padding:24px 32px 32px;">${bodyHtml}</td></tr>` +

  // Footer
  `<tr><td bgcolor="${C.footer}" style="background:${C.footer};border-top:1px solid ${C.line};padding:24px 32px;text-align:center;">` +
  `<p style="margin:0;font-size:14px;font-weight:700;color:${C.primary};">Te Gu\u00edo</p>` +
  `<p style="margin:4px 0 0;font-size:12px;color:${C.muted};">Encuentra lo que buscas, te guiamos hasta all\u00ed</p>` +
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td style="height:1px;background:${C.line};"></td></tr></table>` +
  `<p style="margin:0;font-size:11px;color:${C.faint};line-height:1.5;">Este correo fue enviado autom\u00e1ticamente por Te Gu\u00edo.<br/>Por favor no respondas a este mensaje.</p>` +
  `</td></tr>` +

  // Cierre card + outer
  `</table></td></tr></table></body></html>`;

// ─── 1. VERIFICACIÓN DE EMAIL ────────────────────────────────

const VERIFICACION = [
  greeting('nombre'),
  para('Gracias por registrarte en <strong>Te Gu\u00edo</strong>. Usa este c\u00f3digo para verificar tu cuenta:'),
  digitRow,
  infoBox('\u23f1 Este c\u00f3digo expira en <strong style="color:#312c85;">{{minutos}} minutos</strong>. Si no creaste una cuenta, ignora este correo.'),
].join('');

// ─── 2. RECUPERACIÓN DE CONTRASEÑA ──────────────────────────

const RECUPERACION = [
  greeting('nombre'),
  para('Recibimos una solicitud para restablecer tu contrase\u00f1a. Haz clic en el bot\u00f3n para crear una nueva:'),
  ctaButton('Restablecer Contrase\u00f1a', 'link'),
  infoBox('\u23f1 Este enlace expira en <strong style="color:#312c85;">{{horas}} hora(s)</strong>. Si no solicitaste este cambio, ignora este correo.'),
  `<p style="margin:12px 0 0;font-size:12px;color:${C.muted};">Si el bot\u00f3n no funciona, copia y pega esta URL:</p><p style="margin:4px 0 0;font-size:11px;color:${C.mid};word-break:break-all;">{{link}}</p>`,
].join('');

// ─── 3. SUSCRIPCIÓN POR VENCER ──────────────────────────────

const SUSCRIPCION = [
  greeting('nombre'),
  para('Te informamos que la suscripci\u00f3n de tu tienda est\u00e1 pr\u00f3xima a vencer:'),
  warningBox(`<p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#92400e;">\ud83c\udfea {{tienda}}</p><p style="margin:0;font-size:13px;color:#92400e;">Vence: <strong>{{fecha_vencimiento}}</strong></p>`),
  para('Renueva tu suscripci\u00f3n para mantener tu tienda visible y seguir vendiendo en la plataforma.'),
  infoBox('\ud83d\udca1 Ingresa a la app y dir\u00edgete a <strong style="color:#312c85;">Suscripciones</strong> para renovar.'),
].join('');

// ─── 4. APROBACIÓN DE TIENDA ────────────────────────────────

const APROBACION_TIENDA = [
  greeting('sellerName'),
  para('\u00a1Excelentes noticias! Tu tienda ha sido aprobada exitosamente:'),
  successBox('\ud83c\udfea {{storeName}}'),
  para('Ya puedes comenzar a agregar productos y vender en nuestra plataforma. \u00a1Te deseamos mucho \u00e9xito!'),
  infoBox('\ud83d\udce6 <strong style="color:#312c85;">Siguiente paso:</strong> Agrega tus productos desde la secci\u00f3n "Mis Productos" en la app.'),
].join('');

// ─── 5. APROBACIÓN DE VENDEDOR ──────────────────────────────

const APROBACION_VENDEDOR = [
  greeting('sellerName'),
  para('\u00a1Felicitaciones! Tu solicitud como vendedor ha sido aprobada exitosamente. Ya eres parte de la comunidad de vendedores de <strong>Te Gu\u00edo</strong>.'),
  successBox('\u2713 Cuenta de vendedor activada'),
  para('Ahora puedes crear tu tienda y comenzar a vender en nuestra plataforma.'),
  infoBox('\ud83c\udfea <strong style="color:#312c85;">Siguiente paso:</strong> Crea tu primera tienda desde la app y solicita su aprobaci\u00f3n.'),
].join('');

// ─── Exports ─────────────────────────────────────────────────

const EMAIL_TEMPLATE_DEFAULTS = [
  {
    nombre: 'VERIFICACION_EMAIL',
    asunto_plantilla: 'Verifica tu cuenta - Te Gu\u00edo',
    cuerpo_plantilla: wrap('\ud83d\udee1\ufe0f', 'Verificaci\u00f3n de Cuenta', VERIFICACION),
    variables_json: {
      variables: ['nombre', 'codigo', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'minutos', 'logo_url', 'logo_display'],
      descripcion: 'Se env\u00eda al registrar un nuevo usuario para verificar su email.',
      titulo_display: 'Email de Verificaci\u00f3n',
      categoria: 'VERIFICACION',
      label_tab: 'Verificaci\u00f3n',
      icono_tab: 'verified',
      sections: TEMPLATE_SECTIONS.VERIFICACION_EMAIL.sections,
    },
  },
  {
    nombre: 'RECUPERACION_CONTRASENA',
    asunto_plantilla: 'Restablecer contrase\u00f1a - Te Gu\u00edo',
    cuerpo_plantilla: wrap('\ud83d\udd12', 'Restablecer Contrase\u00f1a', RECUPERACION),
    variables_json: {
      variables: ['nombre', 'link', 'horas', 'logo_url', 'logo_display'],
      descripcion: 'Se env\u00eda cuando un usuario solicita restablecer su contrase\u00f1a.',
      titulo_display: 'Recuperaci\u00f3n de Contrase\u00f1a',
      categoria: 'SEGURIDAD',
      label_tab: 'Contrase\u00f1a',
      icono_tab: 'lock',
      sections: TEMPLATE_SECTIONS.RECUPERACION_CONTRASENA.sections,
    },
  },
  {
    nombre: 'SUSCRIPCION_POR_VENCER',
    asunto_plantilla: 'Tu suscripci\u00f3n est\u00e1 por vencer - Te Gu\u00edo',
    cuerpo_plantilla: wrap('\u26a0\ufe0f', 'Suscripci\u00f3n por Vencer', SUSCRIPCION),
    variables_json: {
      variables: ['nombre', 'tienda', 'fecha_vencimiento', 'logo_url', 'logo_display'],
      descripcion: 'Se env\u00eda cuando la suscripci\u00f3n de una tienda est\u00e1 pr\u00f3xima a vencer.',
      titulo_display: 'Alerta de Vencimiento',
      categoria: 'SUSCRIPCION',
      label_tab: 'Suscripci\u00f3n',
      icono_tab: 'schedule',
      sections: TEMPLATE_SECTIONS.SUSCRIPCION_POR_VENCER.sections,
    },
  },
  {
    nombre: 'APROBACION_TIENDA',
    asunto_plantilla: '\u00a1Tu tienda {{storeName}} ha sido aprobada! - Te Gu\u00edo',
    cuerpo_plantilla: wrap('\u2705', '\u00a1Tienda Aprobada!', APROBACION_TIENDA),
    variables_json: {
      variables: ['storeName', 'sellerName', 'logo_url', 'logo_display'],
      descripcion: 'Se env\u00eda cuando un administrador aprueba una solicitud de tienda.',
      titulo_display: 'Email de Aprobaci\u00f3n de Tienda',
      categoria: 'TIENDA',
      label_tab: 'Tienda',
      icono_tab: 'store',
      sections: TEMPLATE_SECTIONS.APROBACION_TIENDA.sections,
    },
  },
  {
    nombre: 'APROBACION_VENDEDOR',
    asunto_plantilla: '\u00a1Bienvenido {{sellerName}}! Tu cuenta ha sido aprobada - Te Gu\u00edo',
    cuerpo_plantilla: wrap('\ud83c\udf89', '\u00a1Bienvenido a Te Gu\u00edo!', APROBACION_VENDEDOR),
    variables_json: {
      variables: ['sellerName', 'logo_url', 'logo_display'],
      descripcion: 'Se env\u00eda cuando un administrador aprueba una solicitud de vendedor.',
      titulo_display: 'Email de Aprobaci\u00f3n de Vendedor',
      categoria: 'VENDEDOR',
      label_tab: 'Vendedor',
      icono_tab: 'person',
      sections: TEMPLATE_SECTIONS.APROBACION_VENDEDOR.sections,
    },
  },
];

module.exports = {
  EMAIL_TEMPLATE_DEFAULTS,
  TEMPLATE_SECTIONS,
  SAMPLE_DATA,
  buildHtmlFromSections,
  wrap, greeting, para, infoBox, successBox, warningBox, digitRow, ctaButton, C,
};
