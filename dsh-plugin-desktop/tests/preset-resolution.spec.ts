import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('checks shipped preset dependencies through the real Desktop resolver without importing plugins', () => {
  const require = createRequire(import.meta.url)
  const webAppManifest = require.resolve('@deepseek-ai/dsh-web-app/package.json')
  const script = `
    import assert from 'node:assert/strict';
    import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
    import { createRequire } from 'node:module';
    import { tmpdir } from 'node:os';
    import { dirname, join } from 'node:path';
    import { pathToFileURL } from 'node:url';
    const presetRoot = join(dirname(process.argv[2]), 'presets');
    const { installProfilePackageResolver } = await import(pathToFileURL(process.argv[1]).href);
    const root = mkdtempSync(join(tmpdir(), 'desktop-preset-resolution-'));
    let release;
    try {
      const profile = join(root, 'profile');
      mkdirSync(profile);
      const manifestPath = join(profile, 'package.json');
      writeFileSync(manifestPath, '{"type":"module"}');
      const require = createRequire(manifestPath);
      // 0.1.7 dropped the dsh-agent-presets root scanner: a preset is now the
      // plugin list of one @deepseek-ai/dsh-agent-preset declaration, and those
      // rows resolve through the same Desktop resolver the profile loader uses.
      const broken = (name) => {
        try {
          require.resolve(name);
          return undefined;
        } catch (error) {
          return error.code ?? error.message;
        }
      };
      assert.ok(broken('@deepseek-ai/dsh-persona'));
      assert.ok(broken('@deepseek-ai/dsh-tool-subagent-control/list-agents'));
      assert.ok(broken('@desktop-regression/nonexistent'));
      assert.ok(broken('@deepseek-ai/dsh-persona/nonexistent-export'));
      release = installProfilePackageResolver(pathToFileURL(manifestPath).href);
      assert.equal(broken('@deepseek-ai/dsh-persona'), undefined);
      assert.equal(broken('@deepseek-ai/dsh-tool-subagent-control/list-agents'), undefined);
      assert.match(broken('@desktop-regression/nonexistent'), /cannot resolve package/);
      assert.equal(broken('@deepseek-ai/dsh-persona/nonexistent-export'), 'ERR_PACKAGE_PATH_NOT_EXPORTED');
      // Shipped presets are the web-app bundle's payloads, applied in the order
      // its dsh.bundle.patch list declares, and every plugin they name must
      // resolve before the profile loader mounts the preset.
      const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'));
      assert.deepEqual(manifest.dsh.bundle.patch, [
        './cordis.patch.yml',
        './presets/standard.patch.yml',
        './presets/ptc.patch.yml',
        './presets/minimal.patch.yml',
        './presets/cordis.patch.yml',
      ]);
      for (const id of ['cordis', 'standard', 'ptc', 'minimal']) {
        const payload = readFileSync(join(presetRoot, id + '.patch.yml'), 'utf8');
        assert.ok(payload.includes('- id: preset-' + id), id + ' ships no preset declaration');
        assert.ok(
          payload.includes("name: '@deepseek-ai/dsh-agent-preset'"),
          id + ' declares no agent preset',
        );
        const names = [...payload.matchAll(/^\\s*name:\\s*'?([^'\\s]+)'?\\s*$/gmu)].map(match => match[1]);
        for (const name of names) {
          if (name.startsWith('cordis:')) continue;
          assert.equal(broken(name), undefined, 'shipped preset ' + id + ' names unresolvable ' + name);
        }
      }
      // Profile plugins are visible, but resolution must not evaluate their code.
      const override = join(profile, 'node_modules', '@desktop-regression', 'probe');
      mkdirSync(override, { recursive: true });
      writeFileSync(join(override, 'package.json'), '{"name":"@desktop-regression/probe","type":"module","exports":"./index.js"}');
      writeFileSync(join(override, 'index.js'), 'throw new Error("resolution evaluated plugin")');
      assert.equal(broken('@desktop-regression/probe'), undefined);
      // Desktop inserts no preset row of its own; the shipped payloads above
      // are the whole preset surface of the profile.
      assert.ok(!readFileSync(process.argv[3], 'utf8').includes('preset'));
      release();
      release = undefined;
      assert.ok(broken('@deepseek-ai/dsh-persona'));
      console.log('preset resolution passed');
    } finally {
      release?.();
      rmSync(root, { recursive: true, force: true });
    }
  `
  const output = execFileSync(process.execPath, [
    '--input-type=module', '-e', script,
    fileURLToPath(new URL('../src/module-resolution.ts', import.meta.url)),
    webAppManifest,
    fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)),
  ], { encoding: 'utf8', timeout: 30_000 })
  expect(output).toContain('preset resolution passed')
})
