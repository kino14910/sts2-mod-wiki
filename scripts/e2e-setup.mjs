import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Tests use a dedicated local D1 state; never migrate or reset the developer's database.
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const cache = path.join(root, '.cache');
const state = path.join(cache, 'e2e-state');
fs.mkdirSync(cache, { recursive: true });
if (fs.existsSync(state)) {
	// Retain failed-run history for diagnosis, while giving every suite pristine fixtures.
	const archiveRoot = path.join(cache, 'e2e-runs');
	fs.mkdirSync(archiveRoot, { recursive: true });
	const archive = path.join(archiveRoot, `${Date.now()}-${process.pid}`);
	const resolvedRoot = fs.realpathSync(root);
	for (const directory of [cache, state, archiveRoot]) {
		const relative = path.relative(resolvedRoot, fs.realpathSync(directory));
		if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('E2E state must remain inside the project workspace');
	}
	if (path.dirname(state) !== cache || path.dirname(archive) !== archiveRoot) throw new Error('Invalid E2E archive paths');
	fs.renameSync(state, archive);
}
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const run = (...args) => execFileSync(process.execPath, [wrangler, ...args, '--local', '--persist-to', state], { stdio: 'inherit' });
run('d1', 'migrations', 'apply', 'sts2-mod-wiki');
const file = path.resolve('.cache/e2e-users.sql');
fs.writeFileSync(file, ['member', 'trusted', 'moderator', 'admin'].map((role) =>
	`INSERT INTO users (id, auth_subject, username, role, status) VALUES ('user:e2e-${role}', 'e2e-${role}', 'E2E ${role}', '${role}', 'active') ON CONFLICT(auth_subject) DO UPDATE SET role=excluded.role, status='active';`
).join('\n'));
run('d1', 'execute', 'sts2-mod-wiki', '--file', file);
