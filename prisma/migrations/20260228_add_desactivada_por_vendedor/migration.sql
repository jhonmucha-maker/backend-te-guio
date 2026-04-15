-- Agregar campo desactivada_por_vendedor a tbl_tiendas
ALTER TABLE "tbl_tiendas" ADD COLUMN IF NOT EXISTS "desactivada_por_vendedor" BOOLEAN NOT NULL DEFAULT false;
