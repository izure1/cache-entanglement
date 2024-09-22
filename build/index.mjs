import esbuild from 'esbuild'

const common = {
  target: 'esnext',
  bundle: true,
  entryPoints: [
    { in: 'src/index.ts', out: 'index' }
  ]
}

esbuild.build({
  ...common,
  platform: 'browser',
  format: 'esm',
  outdir: 'dist/esm',
  outExtension: {
    '.js': '.mjs'
  }
})

esbuild.build({
  ...common,
  platform: 'node',
  format: 'cjs',
  outdir: 'dist/cjs',
  outExtension: {
    '.js': '.cjs'
  }
})
