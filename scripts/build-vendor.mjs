import { build } from 'esbuild';
await build({ stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: process.cwd(), loader: 'js' }, outfile: 'dist/vendor/supabase.js', bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'eof' });
console.log('Supabase browser client bundled locally.');
