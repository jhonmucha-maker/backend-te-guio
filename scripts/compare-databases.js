/**
 * Compara toda la estructura (tablas, columnas, índices, constraints,
 * triggers, funciones, vistas, secuencias, tipos y extensiones) entre la
 * base de datos LOCAL y la base de datos de RAILWAY.
 *
 * Uso:
 *   node scripts/compare-databases.js
 *
 * Dependencias: requiere que exista psql.exe (PostgreSQL 16 en Windows).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PSQL = 'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe';

const LOCAL_URL = 'postgresql://postgres:sql@localhost:5432/db_te_guio';
const RAILWAY_URL =
  'postgresql://postgres:ogimjGuRncBmQAmVNNLmRtpMZFvtmyCO@mainline.proxy.rlwy.net:39688/railway';

// Consultas a ejecutar. Cada una devuelve filas que se identifican por la
// columna `key` (única) y se comparan campo a campo con la columna `value`.
const QUERIES = {
  extensions: {
    label: 'Extensiones',
    sql: `
      SELECT extname AS key,
             extversion AS value
      FROM pg_extension
      ORDER BY extname;
    `,
  },
  schemas: {
    label: 'Esquemas',
    sql: `
      SELECT nspname AS key, 'schema' AS value
      FROM pg_namespace
      WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast')
        AND nspname NOT LIKE 'pg_temp_%'
        AND nspname NOT LIKE 'pg_toast_temp_%'
      ORDER BY nspname;
    `,
  },
  tables: {
    label: 'Tablas',
    sql: `
      SELECT table_schema || '.' || table_name AS key,
             table_type AS value
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY 1;
    `,
  },
  columns: {
    label: 'Columnas',
    sql: `
      SELECT table_schema || '.' || table_name || '.' || column_name AS key,
             data_type
               || ' | nullable=' || is_nullable
               || ' | default=' || COALESCE(column_default, 'NULL')
               || ' | maxlen=' || COALESCE(character_maximum_length::text,'-')
               || ' | numprec=' || COALESCE(numeric_precision::text,'-')
               || ' | numscale=' || COALESCE(numeric_scale::text,'-')
               || ' | udt=' || udt_name AS value
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY 1;
    `,
  },
  primary_keys: {
    label: 'Primary Keys',
    sql: `
      SELECT tc.table_schema || '.' || tc.table_name || '.' || tc.constraint_name AS key,
             string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS value
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema NOT IN ('pg_catalog','information_schema')
      GROUP BY 1
      ORDER BY 1;
    `,
  },
  foreign_keys: {
    label: 'Foreign Keys',
    sql: `
      SELECT tc.table_schema || '.' || tc.table_name || '.' || tc.constraint_name AS key,
             string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position)
               || ' -> ' || ccu.table_schema || '.' || ccu.table_name
               || '(' || string_agg(ccu.column_name, ',' ORDER BY kcu.ordinal_position) || ')'
               || ' | update=' || rc.update_rule
               || ' | delete=' || rc.delete_rule AS value
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
       AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('pg_catalog','information_schema')
      GROUP BY 1, ccu.table_schema, ccu.table_name, rc.update_rule, rc.delete_rule
      ORDER BY 1;
    `,
  },
  unique_constraints: {
    label: 'Unique Constraints',
    sql: `
      SELECT tc.table_schema || '.' || tc.table_name || '.' || tc.constraint_name AS key,
             string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS value
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema NOT IN ('pg_catalog','information_schema')
      GROUP BY 1
      ORDER BY 1;
    `,
  },
  check_constraints: {
    label: 'Check Constraints',
    sql: `
      SELECT n.nspname || '.' || r.relname || '.' || c.conname AS key,
             pg_get_constraintdef(c.oid) AS value
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      WHERE c.contype = 'c'
        AND n.nspname NOT IN ('pg_catalog','information_schema')
      ORDER BY 1;
    `,
  },
  indexes: {
    label: 'Índices',
    sql: `
      SELECT schemaname || '.' || tablename || '.' || indexname AS key,
             indexdef AS value
      FROM pg_indexes
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
      ORDER BY 1;
    `,
  },
  views: {
    label: 'Vistas',
    sql: `
      SELECT table_schema || '.' || table_name AS key,
             md5(view_definition) AS value
      FROM information_schema.views
      WHERE table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY 1;
    `,
  },
  materialized_views: {
    label: 'Vistas Materializadas',
    sql: `
      SELECT schemaname || '.' || matviewname AS key,
             md5(definition) AS value
      FROM pg_matviews
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
      ORDER BY 1;
    `,
  },
  functions: {
    label: 'Funciones / Procedimientos',
    sql: `
      SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS key,
             md5(pg_get_functiondef(p.oid)) AS value
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema')
        AND p.prokind IN ('f','p','a','w')
      ORDER BY 1;
    `,
  },
  triggers: {
    label: 'Triggers',
    sql: `
      SELECT event_object_schema || '.' || event_object_table || '.' || trigger_name AS key,
             action_timing || ' ' || event_manipulation
               || ' | orient=' || action_orientation
               || ' | stmt=' || md5(action_statement) AS value
      FROM information_schema.triggers
      WHERE trigger_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY 1, event_manipulation;
    `,
  },
  sequences: {
    label: 'Secuencias',
    sql: `
      SELECT sequence_schema || '.' || sequence_name AS key,
             data_type
               || ' | start=' || start_value
               || ' | min=' || minimum_value
               || ' | max=' || maximum_value
               || ' | inc=' || increment
               || ' | cycle=' || cycle_option AS value
      FROM information_schema.sequences
      WHERE sequence_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY 1;
    `,
  },
  enums: {
    label: 'Tipos ENUM',
    sql: `
      SELECT n.nspname || '.' || t.typname AS key,
             string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS value
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      GROUP BY 1
      ORDER BY 1;
    `,
  },
  domains: {
    label: 'Dominios',
    sql: `
      SELECT domain_schema || '.' || domain_name AS key,
             data_type
               || ' | default=' || COALESCE(domain_default,'NULL')
               || ' | nullable=' || is_nullable AS value
      FROM information_schema.domains
      WHERE domain_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY 1;
    `,
  },
};

// --- helpers -------------------------------------------------------------

function runQuery(connUrl, sql) {
  // Usamos -A (unaligned), -t (tuples only), -F '|' (separator) para obtener
  // salida parseable sin decoraciones. Usamos -v ON_ERROR_STOP=1 para fallar
  // rápido si una consulta revienta.
  const out = execFileSync(
    PSQL,
    [
      connUrl,
      '-X',
      '-A',
      '-t',
      '-F', '\t',
      '-v', 'ON_ERROR_STOP=1',
      '-c', sql,
    ],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 200 }
  );
  const map = new Map();
  const lines = out.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab === -1) {
      map.set(line, '');
    } else {
      map.set(line.slice(0, tab), line.slice(tab + 1));
    }
  }
  return map;
}

function diffMaps(localMap, railwayMap) {
  const onlyLocal = [];
  const onlyRailway = [];
  const different = [];

  for (const [k, v] of localMap) {
    if (!railwayMap.has(k)) {
      onlyLocal.push(k);
    } else if (railwayMap.get(k) !== v) {
      different.push({ key: k, local: v, railway: railwayMap.get(k) });
    }
  }
  for (const k of railwayMap.keys()) {
    if (!localMap.has(k)) onlyRailway.push(k);
  }

  onlyLocal.sort();
  onlyRailway.sort();
  different.sort((a, b) => a.key.localeCompare(b.key));
  return { onlyLocal, onlyRailway, different };
}

function printSection(label, diff) {
  const { onlyLocal, onlyRailway, different } = diff;
  const total = onlyLocal.length + onlyRailway.length + different.length;
  console.log('\n' + '='.repeat(80));
  console.log(`[${label}]  diferencias: ${total}`);
  console.log('='.repeat(80));

  if (total === 0) {
    console.log('  (sin diferencias)');
    return;
  }

  if (onlyLocal.length) {
    console.log(`\n  Sólo en LOCAL (${onlyLocal.length}):`);
    for (const k of onlyLocal) console.log('    + ' + k);
  }
  if (onlyRailway.length) {
    console.log(`\n  Sólo en RAILWAY (${onlyRailway.length}):`);
    for (const k of onlyRailway) console.log('    + ' + k);
  }
  if (different.length) {
    console.log(`\n  Con valores distintos (${different.length}):`);
    for (const d of different) {
      console.log('    ~ ' + d.key);
      console.log('        LOCAL   : ' + d.local);
      console.log('        RAILWAY : ' + d.railway);
    }
  }
}

// --- main ----------------------------------------------------------------

(function main() {
  if (!fs.existsSync(PSQL)) {
    console.error('No se encontró psql.exe en: ' + PSQL);
    process.exit(1);
  }

  console.log('Comparando bases de datos...');
  console.log('  LOCAL   : ' + LOCAL_URL.replace(/:[^:@/]+@/, ':****@'));
  console.log('  RAILWAY : ' + RAILWAY_URL.replace(/:[^:@/]+@/, ':****@'));

  const report = { generatedAt: new Date().toISOString(), sections: {} };
  let totalDiffs = 0;

  for (const [name, spec] of Object.entries(QUERIES)) {
    process.stdout.write(`\n-> ${spec.label}...`);
    let localMap, railwayMap;
    try {
      localMap = runQuery(LOCAL_URL, spec.sql);
    } catch (e) {
      console.error(`\n   ERROR consultando LOCAL (${spec.label}): ` + (e.stderr?.toString() || e.message));
      process.exit(2);
    }
    try {
      railwayMap = runQuery(RAILWAY_URL, spec.sql);
    } catch (e) {
      console.error(`\n   ERROR consultando RAILWAY (${spec.label}): ` + (e.stderr?.toString() || e.message));
      process.exit(2);
    }
    process.stdout.write(` local=${localMap.size}  railway=${railwayMap.size}`);
    const diff = diffMaps(localMap, railwayMap);
    const diffCount = diff.onlyLocal.length + diff.onlyRailway.length + diff.different.length;
    totalDiffs += diffCount;
    report.sections[name] = { label: spec.label, ...diff, counts: { local: localMap.size, railway: railwayMap.size } };
  }

  // Reporte textual
  for (const [name, spec] of Object.entries(QUERIES)) {
    printSection(spec.label, report.sections[name]);
  }

  // Guardar JSON
  const outFile = path.join(__dirname, 'db-diff-report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log(`TOTAL de diferencias detectadas: ${totalDiffs}`);
  console.log(`Reporte detallado guardado en: ${outFile}`);
  console.log('='.repeat(80));
})();
