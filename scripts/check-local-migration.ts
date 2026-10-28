import { loadEnvConfig } from '@next/env';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
loadEnvConfig(process.cwd());
async function main() {
  if(process.env.TURSO_DATABASE_URL) throw new Error('Local migration check requires no Turso URL.');
  const source=path.resolve(process.env.DATABASE_PATH || 'data/agentforge.db');
  const target=path.resolve('data/backups/accounts-migration-check.db');
  if(fs.existsSync(target)) throw new Error('Migration check snapshot already exists; choose a fresh path before rerunning.');
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const original=new Database(source,{readonly:true});
  const tables=['agents','workflows','workflow_credentials','workflow_runs','workflow_versions','resources','runs'];
  const before=Object.fromEntries(tables.map(table=>[table,original.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()]));
  await original.backup(target); original.close();
  process.env.DATABASE_PATH=target;
  const {runMigrations,query,sqlite}=await import('../lib/db/client');
  await runMigrations();
  for(const table of tables){const [row]=await query(`SELECT COUNT(*) AS n FROM ${table}`);if(row.n!==(before[table] as {n:number}).n)throw new Error(`Record count changed: ${table}`);}
  const integrity=await query('PRAGMA integrity_check');
  if(integrity[0].integrity_check!=='ok')throw new Error('Integrity check failed');
  sqlite.close();
  console.log('Migration verified on a backup: all record counts preserved; integrity check passed. Original database untouched.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
