const { build } = require('esbuild');
const glob = require('util').promisify(require('glob'));

const args = process.argv.slice(2);


(async () => {
  await build({
	 entryPoints: await glob('./src/*.ts'),
	 minify: false,
	 sourcemap: true,
	 bundle: false,
    platform: 'node',
	 outdir: './out',
	 format: 'cjs',
	 logLevel: 'info',
	 watch: args[0] == 'watch',
  });
})();
