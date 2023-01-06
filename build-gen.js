const { build } = require('esbuild');

const args = process.argv.slice(2);

(async () => {
  await build({
	 entryPoints: ['./src/ui/gen-native-palette.ts'],
	 minify: false,
	 sourcemap: false,
	 bundle: true,
	 outdir: './gen',
    platform: 'node',
	 format: 'cjs',
	 logLevel: 'info',
	 watch: args[0] == 'watch',
  });
})();
