const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('[EMAIL] Transporter SMTP configurado');
  } else {
    transporter = {
      sendMail: async (options) => {
        console.log('══════════════════════════════════════════');
        console.log(`[EMAIL DEV] Para: ${options.to}`);
        console.log(`[EMAIL DEV] Asunto: ${options.subject}`);
        console.log(`[EMAIL DEV] Cuerpo: ${(options.html || options.text || '').substring(0, 300)}`);
        console.log('══════════════════════════════════════════');
        return { messageId: `dev-${Date.now()}` };
      },
    };
    console.log('[EMAIL] Modo desarrollo: emails se imprimen en consola');
  }

  return transporter;
};

const sendEmail = async (to, subject, body, attachments = []) => {
  // Guardia: no enviar a correos de usuarios eliminados
  if (to && /^deleted_\d+_\d+@removed$/.test(to)) {
    console.warn(`[EMAIL] Bloqueado envío a usuario eliminado: ${to}`);
    return false;
  }

  const transport = getTransporter();
  await transport.sendMail({
    from: process.env.SMTP_FROM || '"Marketplace" <noreply@marketplace.pe>',
    to,
    subject,
    html: body,
    attachments,
  });
  return true;
};

const replaceTemplateVars = (text, vars) => {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
};

const sendTemplateEmail = async (templateName, correo, vars, attachments = []) => {
  const template = await prisma.tbl_plantillas_email.findFirst({ where: { nombre: templateName } });
  if (!template) {
    console.error(`[EMAIL] Plantilla "${templateName}" no encontrada en la base de datos`);
    return false;
  }
  const subject = replaceTemplateVars(template.asunto_plantilla, vars);
  const body = replaceTemplateVars(template.cuerpo_plantilla, vars);
  return sendEmail(correo, subject, body, attachments);
};

const getPublicBaseUrl = () => {
  return process.env.BACKEND_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
    || `http://localhost:${process.env.PORT || 4002}`;
};

const buildLogoAttachment = () => {
  const baseUrl = getPublicBaseUrl();
  const isProduction = baseUrl && !baseUrl.includes('localhost');

  // En produccion: logo servido desde S3 via proxy del backend (accesible publicamente)
  if (isProduction) {
    return {
      vars: { logo_url: `${baseUrl}/api/catalog/files/assets/logo.png`, logo_display: 'block' },
      attachments: [],
    };
  }

  // En desarrollo: CID attachment desde filesystem local
  const logoPath = path.join(__dirname, '..', 'uploads', 'logo.png');
  if (fs.existsSync(logoPath)) {
    return {
      vars: { logo_url: 'cid:logo_teguio', logo_display: 'block' },
      attachments: [{ filename: 'logo.png', path: logoPath, cid: 'logo_teguio' }],
    };
  }

  return { vars: { logo_url: '', logo_display: 'none' }, attachments: [] };
};

const sendVerificationEmail = async (correo, codigo, nombre) => {
  const logo = buildLogoAttachment();
  const digits = String(codigo).split('');
  const dVars = {};
  digits.forEach((d, i) => { dVars[`d${i + 1}`] = d; });
  return sendTemplateEmail('VERIFICACION_EMAIL', correo, { nombre, codigo, minutos: '15', ...dVars, ...logo.vars }, logo.attachments);
};

const sendPasswordResetEmail = async (correo, token, nombre) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const logo = buildLogoAttachment();
  return sendTemplateEmail('RECUPERACION_CONTRASENA', correo, { nombre, link: resetUrl, enlace: resetUrl, url: resetUrl, horas: '1', ...logo.vars }, logo.attachments);
};

const sendSubscriptionExpiringEmail = async (vendedorEmail, vendedorNombre, tiendas) => {
  const tiendasTexto = tiendas.map(t =>
    `${t.nombre} (vence: ${t.fin_en.toLocaleDateString('es-PE', { timeZone: 'America/Lima' })})`
  ).join(', ');
  const fechasVencimiento = tiendas.map(t =>
    t.fin_en.toLocaleDateString('es-PE', { timeZone: 'America/Lima' })
  ).join(', ');
  const logo = buildLogoAttachment();
  return sendTemplateEmail('SUSCRIPCION_POR_VENCER', vendedorEmail, {
    nombre: vendedorNombre,
    tienda: tiendasTexto,
    fecha_vencimiento: fechasVencimiento,
    ...logo.vars,
  }, logo.attachments);
};

const sendStoreApprovalEmail = async (correo, storeName, sellerName) => {
  const logo = buildLogoAttachment();
  return sendTemplateEmail('APROBACION_TIENDA', correo, { storeName, sellerName, ...logo.vars }, logo.attachments);
};

const sendSellerApprovalEmail = async (correo, storeName, sellerName) => {
  const logo = buildLogoAttachment();
  return sendTemplateEmail('APROBACION_VENDEDOR', correo, { storeName, sellerName, ...logo.vars }, logo.attachments);
};

module.exports = {
  sendEmail,
  sendTemplateEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSubscriptionExpiringEmail,
  sendStoreApprovalEmail,
  sendSellerApprovalEmail,
};
