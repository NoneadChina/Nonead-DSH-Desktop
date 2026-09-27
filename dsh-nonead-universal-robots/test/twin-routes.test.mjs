/**
 * Task 5 — unit tests for the pure twin route handlers (lib/twin-routes.js).
 *
 * Run directly:  node --test test/twin-routes.test.mjs
 * (Do NOT use `npm test` — npm spawns children over piped stdio, which the
 *  current sandbox rejects with `spawn EPERM`.)
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  TWIN_STATE_PATH,
  TWIN_ASSET_PATH,
  createTwinStateHandler,
  createTwinAssetHandler,
} from '../lib/twin-routes.js';

// ── fixtures ───────────────────────────────────────────────────────────────

const worker = {
  call: async (op) => ({
    get_joint_pose: { joint_positions: [0, 0, 0, 0, 0, 0] },
    get_tcp_pose: { tcp_pose: [0, 0, 0.5, 0, 0, 0] },
    get_robot_model: { robot_model: 'UR3', remote_control: false },
  }[op]),
};

const assetsDir = await mkdtemp(join(tmpdir(), 'ur-twin-assets-'));
await writeFile(join(assetsDir, 'ur3.glb'), Buffer.from([0x67, 0x6c, 0x54, 0x46]));

after(async () => {
  await rm(assetsDir, { recursive: true, force: true });
});

// ── route constants ────────────────────────────────────────────────────────

test('导出固定的宿主路由路径常量', () => {
  assert.equal(TWIN_STATE_PATH, '/dsh-nonead-ur/twin/state');
  assert.equal(TWIN_ASSET_PATH, '/dsh-nonead-ur/twin/asset');
});

// ── /twin/state ────────────────────────────────────────────────────────────

test('已连接时返回 connected + model + q + tcp + ts', async () => {
  const h = createTwinStateHandler({ worker, connectedIps: () => new Set(['1.2.3.4']) });
  const r = await h({ ip: '1.2.3.4' });
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, true);
  assert.equal(r.body.model, 'UR3');
  assert.equal(r.body.q.length, 6);
  assert.equal(r.body.tcp.length, 6);
  assert.equal(typeof r.body.ts, 'number');
});

test('未连接时返回 connected:false 与原因', async () => {
  const h = createTwinStateHandler({ worker, connectedIps: () => new Set() });
  const r = await h({ ip: '1.2.3.4' });
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, false);
  assert.equal(typeof r.body.reason, 'string');
});

// ── Ruling 35：`ip` 可省略，由 host 依据连接注册表解析 ──────────────────────
// 动机：浏览器半**不知道也不该猜**机器人 IP（计划原稿没定义来源，实现者只能退到默认值
// `192.168.1.199`，而真实机器人是 `192.168.2.201` ⇒ 会永远显示"未连接"）。
// host 本来就持有 connectedIps，故把解析放到 host。

test('省略 ip 且无任何机器人连接时返回 200 + connected:false（不是 400/500）', async () => {
  const h = createTwinStateHandler({ worker, connectedIps: () => new Set() });
  const r = await h({});
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, false);
  assert.match(r.body.reason, /no robot connected/i);
});

test('省略 ip 且恰好一个机器人连接时自动解析到它，并回填 body.ip', async () => {
  const seen = [];
  const spy = { call: async (op, params) => { seen.push(params.ip); return worker.call(op, params); } };
  const h = createTwinStateHandler({ worker: spy, connectedIps: () => new Set(['192.168.2.201']) });
  const r = await h({});
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, true);
  assert.equal(r.body.ip, '192.168.2.201');
  assert.ok(seen.length > 0, 'worker 应被调用');
  assert.deepEqual([...new Set(seen)], ['192.168.2.201'], '所有 worker 调用都必须用解析出的 IP');
});

test('省略 ip 但连接了多个机器人时返回 400（有歧义，必须显式指定）', async () => {
  const h = createTwinStateHandler({
    worker,
    connectedIps: () => new Set(['192.168.2.201', '10.0.0.7']),
  });
  const r = await h({});
  assert.equal(r.status, 400);
  assert.deepEqual(r.body.ips, ['10.0.0.7', '192.168.2.201']);
});

test('ip 为空白字符串时按"省略"处理（走注册表解析），不再直接 400', async () => {
  const h = createTwinStateHandler({ worker, connectedIps: () => new Set(['1.2.3.4']) });
  const r = await h({ ip: '   ' });
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, true);
  assert.equal(r.body.ip, '1.2.3.4');
});

test('显式传入一个未连接的 ip 仍返回 connected:false（原行为不变）', async () => {
  const h = createTwinStateHandler({ worker, connectedIps: () => new Set(['1.2.3.4']) });
  const r = await h({ ip: '9.9.9.9' });
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, false);
  assert.match(r.body.reason, /9\.9\.9\.9/);
});

test('worker 抛错时返回 connected:false 而非 500', async () => {
  const bad = { call: async () => { throw new Error('worker down'); } };
  const h = createTwinStateHandler({ worker: bad, connectedIps: () => new Set(['1.2.3.4']) });
  const r = await h({ ip: '1.2.3.4' });
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, false);
  assert.match(r.body.reason, /worker down/);
});

test('worker 为 null（Python 半初始化失败）时返回 200 + connected:false', async () => {
  const h = createTwinStateHandler({ worker: null, connectedIps: () => new Set(['1.2.3.4']) });
  const r = await h({ ip: '1.2.3.4' });
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, false);
  assert.equal(typeof r.body.reason, 'string');
});

test('connectedIps 注册表抛错时降级为未连接而非崩溃', async () => {
  const h = createTwinStateHandler({
    worker,
    connectedIps: () => { throw new Error('registry boom'); },
  });
  const r = await h({ ip: '1.2.3.4' });
  assert.equal(r.status, 200);
  assert.equal(r.body.connected, false);
});

// ── /twin/asset ────────────────────────────────────────────────────────────

test('合法型号命中时返回 200 + model/gltf-binary + Buffer', async () => {
  const h = createTwinAssetHandler({ assetsDir });
  const r = await h({ model: 'ur3' });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'model/gltf-binary');
  assert.ok(Buffer.isBuffer(r.body), 'body 必须是 Buffer');
  assert.equal(r.body.length, 4);
  assert.equal(r.headers['content-length'], '4');
});

test('未知型号（白名单合法但无文件）返回 404', async () => {
  const h = createTwinAssetHandler({ assetsDir });
  const r = await h({ model: 'ur9999' });
  assert.equal(r.status, 404);
  assert.ok(!Buffer.isBuffer(r.body));
});

test('assets/models 目录尚不存在时优雅返回 404（不抛错）', async () => {
  const h = createTwinAssetHandler({ assetsDir: join(assetsDir, 'does-not-exist-yet', 'models') });
  const r = await h({ model: 'ur3' });
  assert.equal(r.status, 404);
});

test('未提供 assetsDir 时返回 404（不抛错）', async () => {
  const h = createTwinAssetHandler({});
  const r = await h({ model: 'ur3' });
  assert.equal(r.status, 404);
});

test('缺少 model 参数时返回 400', async () => {
  const h = createTwinAssetHandler({ assetsDir });
  const r = await h({});
  assert.equal(r.status, 400);
});

test('路径穿越取值一律被拒且不泄露文件内容', async () => {
  const h = createTwinAssetHandler({ assetsDir });
  const attacks = [
    '../../package.json',
    '..\\..\\package.json',
    'ur3/../../package.json',
    '../ur3',
    'ur3.glb',
    '/etc/passwd',
    '....//....//package.json',
    'UR3',
    'ur 3',
    'ur3\u0000',
  ];
  for (const model of attacks) {
    const r = await h({ model });
    assert.equal(r.status, 400, `「${model}」必须被拒（实际 ${r.status}）`);
    assert.ok(!Buffer.isBuffer(r.body), `「${model}」不得返回文件内容`);
    assert.doesNotMatch(JSON.stringify(r.body), /nonead-universal-robots/);
  }
});
