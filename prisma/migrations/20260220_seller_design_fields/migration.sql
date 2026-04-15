-- Agregar campos a tbl_tiendas para el nuevo diseño del vendedor
ALTER TABLE "tbl_tiendas" ADD COLUMN IF NOT EXISTS "telefono" VARCHAR(20);
ALTER TABLE "tbl_tiendas" ADD COLUMN IF NOT EXISTS "numero_local" VARCHAR(50);
ALTER TABLE "tbl_tiendas" ADD COLUMN IF NOT EXISTS "observacion" TEXT;

-- Agregar campos a tbl_perfiles_vendedor para tipo de comprobante
ALTER TABLE "tbl_perfiles_vendedor" ADD COLUMN IF NOT EXISTS "tipo_comprobante" VARCHAR(20) DEFAULT 'BOLETA';
ALTER TABLE "tbl_perfiles_vendedor" ADD COLUMN IF NOT EXISTS "razon_social" VARCHAR(200);
