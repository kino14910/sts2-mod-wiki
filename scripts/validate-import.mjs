import fs from 'node:fs';
import { contentDigest, validateBundle, verifyBundleFiles } from './imported-mods.ts';

const [filename, publicRoot, configFile] = process.argv.slice(2);
if (filename === '--digest') {
	// Python sends its original JSON here, before JavaScript can round an integer.
	// contentDigest rejects non-finite numbers and integers outside the safe range.
	console.log(contentDigest(JSON.parse(fs.readFileSync(0, 'utf8'))));
} else {
	if (!filename || !publicRoot || !configFile) throw new Error('Expected <bundle.json> <public root> <config.json>, or --digest with JSON on stdin');
	const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
	const bundle = validateBundle(value, value.id);
	verifyBundleFiles(bundle, publicRoot, configFile);
	console.log(`Validated ${bundle.id}: ${Object.values(bundle.data).reduce((total, rows) => total + rows.length, 0)} entities`);
}
