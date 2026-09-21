/**
 * dsh-nonead-universal-robots — tool-definition DSL guard (no robot, no Python).
 *
 * DSH's value-schema DSL accepts only
 * `type/oneOf/properties/required/additionalProperties/items/enum/const` plus
 * the annotations `description/title/default/examples`. A single unsupported
 * keyword makes `registerTool` throw and silently removes that whole tool from
 * the model's catalog — `minimum`/`maximum`/`exclusiveMinimum` did exactly that
 * to all 16 motion and register/IO tools between 0.3.6 and 0.3.8.
 *
 * Run with: npm test
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'index.js'), 'utf8');

/** Keywords the DSL rejects on a schema node. */
const FORBIDDEN_KEYS = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'pattern'];

/** Strip block and line comments so this file's own documentation cannot trip the scan. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^[ \t]*\/\/.*$/gmu, '');
}

const code = stripComments(source);
const toolNames = [...source.matchAll(/toolName:\s*'([^']+)'/gu)].map(match => match[1]);

test('declares at least one ur_* tool', () => {
  assert.ok(toolNames.length > 0, 'no toolName entries found in lib/index.js');
  for (const name of toolNames) {
    assert.match(name, /^ur_[a-z0-9_]+$/u, `unexpected tool name: ${name}`);
  }
  assert.equal(new Set(toolNames).size, toolNames.length, 'duplicate toolName entries');
});

test('uses only value-schema DSL keywords the DSH tool registry accepts', () => {
  for (const key of FORBIDDEN_KEYS) {
    const pattern = new RegExp(`\\b${key}\\b`, 'gu');
    const hits = [...code.matchAll(pattern)];
    assert.equal(
      hits.length,
      0,
      `lib/index.js uses unsupported schema keyword "${key}" (${String(hits.length)}x): `
        + 'the DSH value schema DSL rejects the whole tool definition. Express the limit in the description instead.',
    );
  }
});
