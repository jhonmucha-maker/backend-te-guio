/**
 * Script para actualizar las plantillas de email en la base de datos.
 * Ejecutar con: node scripts/updateEmailTemplates.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { EMAIL_TEMPLATE_DEFAULTS } = require('../config/emailTemplateDefaults');

const prisma = new PrismaClient();

async function main() {
  console.log('[EMAIL TEMPLATES] Actualizando plantillas...\n');

  for (const tmpl of EMAIL_TEMPLATE_DEFAULTS) {
    const result = await prisma.tbl_plantillas_email.upsert({
      where: { nombre: tmpl.nombre },
      update: {
        asunto_plantilla: tmpl.asunto_plantilla,
        cuerpo_plantilla: tmpl.cuerpo_plantilla,
        variables_json: tmpl.variables_json,
        fecha_hora_modificacion: new Date(),
      },
      create: {
        ...tmpl,
        id_usuario_registro: 1,
      },
    });
    console.log(`  ✓ ${tmpl.nombre} (id: ${result.id})`);
  }

  console.log(`\n[EMAIL TEMPLATES] ${EMAIL_TEMPLATE_DEFAULTS.length} plantillas actualizadas.`);
}

main()
  .catch((e) => {
    console.error('[EMAIL TEMPLATES] Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
