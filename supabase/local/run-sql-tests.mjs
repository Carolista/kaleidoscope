// Runs the migrations and SQL tests in supabase/tests against PGlite (Postgres compiled to
// WebAssembly), with no install of Postgres and no hosted project. See supabase/README.md.
//
//   npm run test:sql                       every test file
//   npm run test:sql -- beta_testing       one or more, by name (".sql" optional)
//
// Supabase's own pieces (roles, auth.users, auth.uid(), a minimal storage schema) are stood in
// for by stubs.sql, so a pass here is strong evidence but not proof for the hosted project.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, '..', 'migrations')
const testsDir = path.join(here, '..', 'tests')

const requested = process.argv.slice(2).map(name => name.replace(/\.sql$/, ''))
const available = fs
	.readdirSync(testsDir)
	.filter(file => file.endsWith('.sql'))
	.map(file => file.replace(/\.sql$/, ''))
	.sort()
const unknown = requested.filter(name => !available.includes(name))
if (unknown.length > 0) {
	console.error(`No such test: ${unknown.join(', ')}`)
	process.exit(2)
}
const selected = requested.length > 0 ? requested : available

const db = new PGlite()
await db.exec(fs.readFileSync(path.join(here, 'stubs.sql'), 'utf8'))
for (const file of fs.readdirSync(migrationsDir).sort()) {
	try {
		await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
	} catch (error) {
		console.error(`Migration ${file} failed: ${error.message}`)
		process.exit(1)
	}
}

let failed = 0
for (const name of selected) {
	try {
		const results = await db.exec(
			fs.readFileSync(path.join(testsDir, `${name}.sql`), 'utf8'),
		)
		const passes = results
			.flatMap(result => result.rows.map(row => Object.values(row)[0]))
			.filter(
				value => typeof value === 'string' && value.startsWith('PASS'),
			)
		console.log(`ok    ${name} (${passes.length} assertions)`)
	} catch (error) {
		failed += 1
		console.log(`FAIL  ${name}: ${error.message}`)
		// A failed test leaves its transaction open.
		await db.exec('rollback').catch(() => {})
	}
}
process.exit(failed > 0 ? 1 : 0)
