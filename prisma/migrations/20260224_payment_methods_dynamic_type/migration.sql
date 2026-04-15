-- 1. Agregar nuevas columnas
ALTER TABLE "tbl_metodos_pago" ADD COLUMN "tipo" VARCHAR(20);
ALTER TABLE "tbl_metodos_pago" ADD COLUMN "cci" VARCHAR(20);
ALTER TABLE "tbl_metodos_pago" ADD COLUMN "numero_celular" VARCHAR(9);

-- 2. Migrar datos existentes (inferir tipo del campo nombre)
UPDATE "tbl_metodos_pago" SET "tipo" = 'YAPE', "numero_celular" = "numero_cuenta" WHERE "nombre" ILIKE '%yape%';
UPDATE "tbl_metodos_pago" SET "tipo" = 'PLIN', "numero_celular" = "numero_cuenta" WHERE "nombre" ILIKE '%plin%';
UPDATE "tbl_metodos_pago" SET "tipo" = 'BANCO' WHERE "tipo" IS NULL;

-- 3. Hacer tipo NOT NULL
ALTER TABLE "tbl_metodos_pago" ALTER COLUMN "tipo" SET NOT NULL;

-- 4. Renombrar banco -> nombre_banco
ALTER TABLE "tbl_metodos_pago" RENAME COLUMN "banco" TO "nombre_banco";

-- 5. Limpiar: Para YAPE/PLIN poner numero_cuenta a NULL (ya migrado a numero_celular)
UPDATE "tbl_metodos_pago" SET "numero_cuenta" = NULL WHERE "tipo" IN ('YAPE', 'PLIN');

-- 6. Eliminar columnas obsoletas
ALTER TABLE "tbl_metodos_pago" DROP COLUMN "nombre";
ALTER TABLE "tbl_metodos_pago" DROP COLUMN "instrucciones";
