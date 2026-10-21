/**
 * Skin client bundle: `src/client/index.ts` → `lib/client.js`.
 *
 * `dsh-nonead-client-skin` is a `file:` dependency consumed by
 * `nonead-dsh-desktop`, not a Yarn workspace: it has no `node_modules` of its
 * own, so this config deliberately avoids importing `tsdown` and exports a
 * plain object instead. Bundle it from this directory with the `tsdown`
 * executable that `nonead-dsh-desktop` already installs:
 *
 *     ..\nonead-dsh-desktop\node_modules\.bin\tsdown.cmd
 *
 * The `window.__ModuleLoader__.load` wrapper matches
 * `dsh-community-market/tsdown.config.ts` so both bundles register the same way.
 * Only the browser half is built here; `lib/index.js` and `lib/invariant.js`
 * are host-side entry points and stay as they are.
 */
const PACKAGE_NAME = 'dsh-nonead-client-skin'

export default {
  name: `${PACKAGE_NAME}/client`,
  entry: { client: 'src/client/index.ts' },
  tsconfig: 'tsconfig.client.json',
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  fixedExtension: false,
  dts: false,
  clean: false,
  sourcemap: true,
  external: ['@deepseek-ai/cordis'],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}
