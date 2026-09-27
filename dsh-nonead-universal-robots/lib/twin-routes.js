/**
 * dsh-nonead-universal-robots — host HTTP routes for the UR digital twin.
 *
 * © 2026 拓德科技 / Suzhou Nonead Robot Technology Co., Ltd. — https://www.nonead.com
 *
 * Two read-only endpoints consumed by the sidebar 3D twin:
 *   GET <TWIN_STATE_PATH>[?ip=<ip>]  → live joint angles + TCP + robot model
 *                                      (`ip` optional — Ruling 35: omitted means
 *                                      "the single connected robot")
 *   GET <TWIN_ASSET_PATH>?model=<urXX> → assets/models/<urXX>.glb (Ruling 7:
 *                                        `/plugins/<id>/` only serves client.js/.map)
 *
 * Design: both handlers are **pure logic** — they never touch `req`/`res`, the
 * socket or the filesystem layout beyond an injected `assetsDir`. `lib/index.js`
 * does the HTTP plumbing (trust fence, method check, query parsing, status
 * write). This split keeps the security-relevant decisions unit-testable
 * without a live server.
 *
 * Failure policy: the twin is a best-effort *visualisation* channel. A missing
 * robot, a dead worker or a not-yet-downloaded mesh asset must never turn into
 * a 5xx that the client would surface as a hard error — they degrade to
 * `connected:false` / an empty 404 instead.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

/**
 * Route paths (Ruling 22): the single source of truth is the **zero-import**
 * `lib/twin-paths.js`, shared verbatim with the browser half so the two can
 * never drift. Re-exported here to keep this module's public surface — this
 * file must NOT be imported by the client: it pulls in `node:fs` for the GLB
 * route, which cannot be bundled for the browser.
 */
export { TWIN_STATE_PATH, TWIN_ASSET_PATH } from './twin-paths.js';

/**
 * Model-id whitelist. Deliberately strict: `[a-z0-9]+` cannot express any path
 * separator, `.` or `..`, so a whitelisted id can never climb out of
 * `assetsDir` (the explicit containment check below is defence in depth).
 */
const MODEL_ID_RE = /^[a-z0-9]+$/;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

/** Trim a query value; anything that is not a string becomes ''. */
function textOf(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Build the `/twin/state` handler.
 *
 * `ip` is **optional** (Ruling 35): the host owns the connection registry, so
 * the browser half must not have to know — or guess — the robot's address.
 *   - `ip` given             → that robot (unchanged behaviour);
 *   - omitted, 0 connected   → `connected:false` / "no robot connected";
 *   - omitted, exactly 1     → that robot (the common single-robot case);
 *   - omitted, 2+ connected  → 400 (ambiguous: the caller must disambiguate).
 *
 * @param {object} deps
 * @param {{call: Function}|null} deps.worker live UR worker (may be null when
 *   the Python worker failed to initialise).
 * @param {() => Set<string>} deps.connectedIps registry of IPs the `connect`
 *   tool has successfully reached. Advisory only — correctness rests on the
 *   catch below.
 * @returns {(query?: {ip?: string}) => Promise<{status: number, body: object}>}
 */
export function createTwinStateHandler({ worker, connectedIps } = {}) {
  const registry = typeof connectedIps === 'function' ? connectedIps : () => new Set();

  /** Read the registry defensively — a throwing source degrades to "unknown". */
  function knownIps() {
    try {
      const value = registry();
      return value instanceof Set ? [...value] : [];
    } catch {
      return [];
    }
  }

  return async function handleTwinState(query = {}) {
    const requested = textOf(query?.ip);
    let ip = requested;

    if (ip === '') {
      const ips = knownIps();
      if (ips.length === 0) {
        return { status: 200, body: { connected: false, reason: 'no robot connected' } };
      }
      if (ips.length > 1) {
        return {
          status: 400,
          body: { error: 'multiple robots connected; pass ?ip=<ip>', ips: ips.slice().sort() },
        };
      }
      ip = ips[0];
    } else if (!knownIps().includes(ip)) {
      return { status: 200, body: { connected: false, reason: `robot ${ip} is not connected` } };
    }

    if (worker === null || worker === undefined || typeof worker.call !== 'function') {
      return { status: 200, body: { connected: false, ip, reason: 'UR worker unavailable' } };
    }

    try {
      const [jp, tp, md] = await Promise.all([
        worker.call('get_joint_pose', { ip }),
        worker.call('get_tcp_pose', { ip }),
        worker.call('get_robot_model', { ip }),
      ]);
      return {
        status: 200,
        body: {
          connected: true,
          // Echoed so the client can show *which* robot it resolved to when it
          // did not pass ?ip= itself.
          ip,
          model: String(md?.robot_model ?? '').trim(),
          q: Array.isArray(jp?.joint_positions) ? jp.joint_positions : [],
          tcp: Array.isArray(tp?.tcp_pose) ? tp.tcp_pose : [],
          ts: Date.now(),
        },
      };
    } catch (e) {
      // Never 500 on a robot/worker error — the poller treats this exactly like
      // a disconnected robot and keeps its backoff going.
      return {
        status: 200,
        body: { connected: false, ip, reason: e instanceof Error ? e.message : String(e) },
      };
    }
  };
}

/**
 * Build the `/twin/asset` handler.
 *
 * @param {object} deps
 * @param {string} deps.assetsDir absolute path of `assets/models`. The
 *   directory may legitimately not exist yet (meshes are still being
 *   produced), in which case every lookup is a clean 404.
 * @returns {(query?: {model?: string}) => Promise<{status: number, headers: object, body: Buffer|object}>}
 */
export function createTwinAssetHandler({ assetsDir } = {}) {
  const root = typeof assetsDir === 'string' && assetsDir.trim() !== '' ? resolve(assetsDir) : '';
  const rootPrefix = root === '' ? '' : root + sep;

  return async function handleTwinAsset(query = {}) {
    const model = textOf(query?.model);
    if (model === '') {
      return { status: 400, headers: JSON_HEADERS, body: { error: 'model is required' } };
    }
    if (!MODEL_ID_RE.test(model)) {
      // Covers `../../package.json`, `..\..\package.json`, `a/b`, `UR3`, …
      return { status: 400, headers: JSON_HEADERS, body: { error: 'invalid model id' } };
    }
    if (root === '') {
      return { status: 404, headers: JSON_HEADERS, body: { error: 'asset not found' } };
    }

    const file = join(root, `${model}.glb`);
    if (!file.startsWith(rootPrefix)) {
      // Unreachable while MODEL_ID_RE holds; kept so a future relaxation of the
      // whitelist cannot silently become a traversal primitive.
      return { status: 400, headers: JSON_HEADERS, body: { error: 'invalid model id' } };
    }

    try {
      const body = await readFile(file);
      return {
        status: 200,
        headers: {
          'content-type': 'model/gltf-binary',
          'content-length': String(body.length),
        },
        body,
      };
    } catch {
      // ENOENT (assets/models/ still absent) and EISDIR both land here.
      return { status: 404, headers: JSON_HEADERS, body: { error: 'asset not found' } };
    }
  };
}
