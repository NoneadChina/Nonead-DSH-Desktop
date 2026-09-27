# dsh-nonead-universal-robots

**A DeepSeek Harness (DSH) plugin that lets you control Universal Robots (UR) collaborative arms directly from natural language, developed by Suzhou Nonead Robot Technology Co., Ltd. based on the same logic as the company's own nUR MCP Server.** ([Suzhou Nonead Robot Technology Co., Ltd.](https://www.nonead.com))

This plugin shares the same ancestry as the company's `Nonead-Universal-Robots-MCP` (see "Reference implementation" below). It exposes the "control a UR robot with AI" capability as **native DSH tools**: the plugin starts a persistent Python worker (which internally reuses the vendored `URBasic` library), and tools talk to the robot through that worker. After a single `connect`, you can keep issuing commands to the same IP.

> ⚠️ **Safety notice**: this plugin drives a real robotic arm directly. Always keep the robot in sight, keep the emergency stop within reach, and keep the workspace clear of people/obstacles. Treat it with the same care as granting the `bash` tool. You (or the model) bear full responsibility for any motion command.

> 🛡️ **Motion approval gate**: commands that physically move the arm or run a program — `ur_movej` / `ur_movel` / `ur_move_x|y|z` / `ur_draw_*` / `ur_load_program` / `ur_run_program` / `ur_send_script` / `ur_reset_error` — **pause and wait for human confirmation** before being sent to the robot. In an interactive deployment (approval policy `ask`) a confirmation dialog is shown in the UI; a call made without an approval service or without an agent **fails closed** (the command is rejected) and never moves without approval. Set `requireApprovalForMotion: false` to disable this gate.

---

## Feature overview

| Category | Tool(s) (`ur_*`) | Description |
|---|---|---|
| Connection | `ur_connect` / `ur_disconnect` | Connect / disconnect a UR robot by IP |
| Status | `ur_get_status` | One-shot read of TCP, joints, model, serial, version, safety mode, run/program state, voltage, current, temperatures, uptime |
| Pose | `ur_get_tcp_pose` / `ur_get_joint_pose` | Read current TCP pose / joint angles |
| Device info | `ur_get_robot_model` / `ur_get_serial_number` / `ur_get_uptime` / `ur_get_software_version` / `ur_get_safety_mode` / `ur_get_robot_mode` | Model (with `remote_control` field) / serial / uptime / software version / safety mode / run state |
| Programs | `ur_get_program_state` / `ur_load_program` / `ur_run_program` / `ur_stop_program` / `ur_pause_program` / `ur_list_programs` | Program state, load, run, stop, pause, SSH listing (`list_programs` works with the real robot's `/programs` and URSim `~/URSim_Linux-*/programs.*`; `load/run` accept full/URSim paths and `programs_dir`) |
| Registers | `ur_get_int_register` / `ur_get_double_register` / `ur_get_bit_register` | Read Int / Double / Bool registers |
| Health | `ur_ping` | Check worker/Python/URBasic readiness without a robot |
| I/O | `ur_get_digital_in` / `ur_set_digital_out` / `ur_get_digital_in_bits` / `ur_get_digital_out_bits` / `ur_get_analog_in` / `ur_set_analog_out` | Digital in/out (incl. **bit-mask reads**, plus `which="tool"` for the tool-flange digital I/O), standard analog in/out |
| Tool config | `ur_set_tool_voltage` / `ur_set_tcp` / `ur_set_payload` | Tool voltage, TCP, payload mass/center of gravity |
| Conveyor | `ur_get_conveyor` / `ur_set_conveyor_tick` | Conveyor tick read / set |
| Motion | `ur_movej` / `ur_movel` / `ur_movep` / `ur_movec` / `ur_servoj` / `ur_move_x` / `ur_move_y` / `ur_move_z` | Joint-space / linear / path / circular / continuous servo / axis-aligned motion |
| Drawing | `ur_draw_circle` / `ur_draw_square` / `ur_draw_rectangle` / `ur_draw_star` | Draw a circle / square / rectangle / pentagram (incl. URSim paths) |
| Script / emergency | `ur_send_script` / `ur_reset_error` | Send URScript / reset errors |

Every tool except `connect` takes an `ip` argument and requires that IP to be **connected first**.

### Read-only 3D digital twin

The plugin also ships a **read-only 3D digital twin** of the robot, rendered with three.js: a compact thumbnail in the sidebar and a large view in the center column. Both views share a single polling state source, so they stay in sync with the live robot's **joint poses, tool (TCP) coordinate frame and recent motion trajectory**. The twin is **strictly read-only — it never sends a command to the robot**: it only polls the host's read-only routes (`/dsh-nonead-ur/twin/state` and `/dsh-nonead-ur/twin/asset`, both fenced to loopback callers) and renders what it receives.

---

## Install into a DSH profile

### Option 1 — install as a bundle (manual)

1. Add the plugin as a dependency in your target profile's `package.json`:

   ```jsonc
   // C:\Users\<you>\.dsh\profiles\web\package.json
   {
     "dependencies": {
       "dsh-nonead-universal-robots": "^0.4.0"
     },
     "dsh": {
       "profile": {
         "bundles": [               // add the plugin here (later order is fine)
           "...",
           "dsh-nonead-universal-robots"
         ]
       }
     }
   }
   ```

2. Install dependencies via `dsh plugin` (equivalent to running pnpm inside the profile directory):

   ```sh
   dsh plugin --profile web install
   # or cd "$DSH_HOME/profiles/web" && pnpm install
   ```

3. Restart DSH. The plugin's `cordis.patch.yml` automatically inserts the plugin line into the config tree, and the tools appear in the model's tool list as `ur_*`.

### Option 2 — local path (development)

Add the repository path to the profile dependency (pnpm supports `file:`) to iterate in this repository:

```jsonc
"dependencies": {
  "dsh-nonead-universal-robots": "file:D:/MyProgram/GitLab/dsh-Nonead-Universal-Robots/dsh-nonead-universal-robots"
}
```

---

## Python runtime

The plugin needs a usable Python and a few dependencies (`numpy`, `paramiko`) to start the worker. Point it at an interpreter with the `pythonBin` config:

```sh
pip install -r requirements.txt
```

`pythonBin` (default `python`), `commandTimeoutMs` (motion/script timeout, default `60000`), and `connectTimeoutMs` (first-connect timeout, default `30000`) in `cordis.patch.yml` can all be overridden per deployment. If `python` is not on PATH, use an absolute path, e.g. `"C:\\Python312\\python.exe"` or `"/usr/bin/python3"`.

---

## Health check / testing

Verify the plugin and Python runtime without touching a real robot:

```sh
npm run test:python   # python ur_worker.py --selfcheck: verify Python/numpy/paramiko/URBasic/RTDE config
npm test              # start a real worker, run ping + an invalid op (verify the stdio protocol & process mgmt)
```

`npm test` prints `selftest passed.` or exits non-zero. If `python` is not on PATH, set it via the environment:

```sh
UR_PYTHON=C:\\Python312\\python.exe npm test
```

Run the **host compatibility check** before a release and whenever the DSH runtime is upgraded — it validates the plugin against an installed host instead of a copy of its keyword list:

```sh
node scripts/check-host-compat.mjs                 # host = ../dsh-plugin-desktop/node_modules
node scripts/check-host-compat.mjs <node_modules>  # or an explicit host
```

It checks the peer ranges against the installed versions, compiles **every** tool parameter schema with the host's real value-schema DSL (a rejected schema silently drops that tool), drives the host route registration, and validates the `dsh.client` declaration plus the client bundle's `__ModuleLoader__` id. Exit code `0` means this plugin works with that host.

> The first `ur_connect` to a robot has an ~20s RTDE readiness wait; on timeout it returns a clear error rather than hanging.

---

## How it works

```
DSH model        @deepseek-ai/dsh-tools        python/ur_worker.py          UR robot
  │  ur_movej(...)  │                              │                          │
  ├────────────────►  ctx.tools.register(defineTool)                        │
  │                  │  lib/worker.js               │                          │
  │                  ├── spawn(ur_worker.py) ──────►│  import URBasic          │
  │                  │   {id,op,params} ───────────►│  RTDE+Dashboard+RTC      │
  │                  │  ◄── {message,data} ─────────┤  run each op             │
  │  ◄── text ───────┤                              │                          │
```

- **`python/ur_worker.py`** — a persistent stdio JSON worker. It keeps `ROBOTS` / `ROBOT_MODELS` dicts, connects by IP, and runs one command per call. Motion commands use (bounded) "arrival confirmation" polling and return a structured error on failure.
- **`lib/worker.js`** — lazily starts the worker once and keeps it alive, matching line-delimited JSON requests/responses, with timeout and cancel (forwards `exec.signal`).
- **`lib/index.js`** — the Cordis plugin that imports `defineTool` to register the above as tools; `inject: ['tools']`.

---

## Tool naming & examples

Tool names are stable as `ur_*`. Example prompts:

> Connect to 192.168.1.199 and read the current TCP pose.

```
ur_connect(ip="192.168.1.199")
ur_get_tcp_pose(ip="192.168.1.199")
```

> Lower the TCP of 192.168.1.199 by 20mm along the Z axis.

```
ur_get_tcp_pose(ip="192.168.1.199")
ur_move_z(ip="192.168.1.199", distance=-0.02)
```

> Draw a circle of radius 50mm (vertical plane).

```
ur_draw_circle(ip="192.168.1.199", center=[0.3,-0.2,0.4,0,3.14,0], r=0.05)
```

---

## Reference implementation

- Plugin repository: <https://github.com/NoneadChina/dsh-nonead-universal-robots>

This plugin shares the same ancestry as Nonead's [`Nonead-Universal-Robots-MCP`](https://gitee.com/nonead/Nonead-Universal-Robots-MCP) (GitHub: <https://github.com/nonead/Nonead-Universal-Robots-MCP>), reusing its `URBasic` library and robot-control logic, re-encapsulated by the same team for DeepSeek Harness as this plugin's `ur_*` tools and stdio worker protocol. `URBasic` is MIT (© Tony Ke & Anthony Zhuang / Universal Robots, 2009-2025).

---

## Notes / limitations

- **Connection persistence** — the worker process lives for the plugin's lifetime and keeps robot connections by IP; after a worker crash or a DSH restart you must `connect` again.
- **Remote control mode** — some UR robots must be in "remote control" to execute motion/program commands; `ur_connect` reports that state.
- **Tool digital I/O** — `ur_get_digital_in` / `ur_set_digital_out` with `which="tool"` control the tool-flange digital I/O. Tool digital signals are **not carried by RTDE**, so reading a tool input runs a short URScript program (via `SendProgram`) that may **interrupt a running program**; writing a tool output sends the URScript `write_tool_digital_out` command. Tool digital **output read-back is not supported** (no reliable `read_tool_digital_out` expression).
- **Joint current** — the current RTDE recipe does not expose per-joint current directly, so `ur_get_joint_current` is not provided (the reference implementation's version of this tool has a value bug; this implementation does not carry it over).
- **Threading / cancel** — motion commands poll until arrival within `commandTimeoutMs`; for long trajectories, remind the model in the prompt to set a reasonable timeout or split the motion into steps.
- **Not a safety boundary** — this plugin is on par with the `bash` tool and can drive physical equipment; test thoroughly on a real robot before production use.
- **Package size** — the published package is about **35 MB**, almost entirely the **14 `assets/models/*.glb`** meshes; the plugin's own code adds only a few hundred KB. If size matters for your deployment, regenerate a subset with `python scripts/convert-meshes.py --only <model…>`.
- **Unknown models fall back** — a robot whose model has no bundled mesh (unknown or customized model string) is rendered with **approximate geometry instead of failing**; the twin never errors out on an unknown model.
- **Asset pipeline** — the meshes are generated by `python scripts/convert-meshes.py` and their structure contract (7 named nodes per GLB, embedded textures) is validated by `python scripts/verify-models.py` (also exposed as `npm run verify:models`).

---

## Third-party assets & licensing

Beyond its own code, this package distributes 14 robot meshes under `assets/models/*.glb` (≈35 MB) plus `assets/kinematics.json`, all derived from Universal Robots' [`Universal_Robots_ROS2_Description`](https://github.com/UniversalRobots/Universal_Robots_ROS2_Description) (branch `humble`, fetched 2026-09-21).

Two licence regimes apply, split by model, and they are never mixed within a model:

- **BSD-3-Clause** (9 models): `ur3`, `ur5`, `ur10`, `ur3e`, `ur5e`, `ur7e`, `ur10e`, `ur12e`, `ur16e` — this covers the meshes and the kinematic / joint-limit configuration that `assets/kinematics.json` is derived from.
- **UR "Graphical Documentation" terms** (5 models): `ur8long`, `ur15`, `ur18`, `ur20`, `ur30`. These meshes are **not** BSD-3-Clause; they are UR "Graphical Documentation" and their use is governed by UR's *Terms and Conditions for use of Graphical Documentation*, which is not an OSI open-source licence but does allow use, modification and sharing under certain restrictions. Questions: <legal@universal-robots.com>.

The client-side 3D renderer builds on [three.js](https://threejs.org/) (MIT); [esbuild](https://esbuild.github.io/) (MIT) is used only at build time.

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for the per-model derivation list, the conversion parameters and the licence texts.

---

## License

This project adopts a **User-Segmented Dual Licensing** model:

- **AGPLv3** for individual users and organizations with **≤10 people** (open source; see <https://www.gnu.org/licenses/agpl-3.0.html>).
- **Commercial license (required)** for organizations with **>10 people**, or for anyone who needs to avoid the AGPLv3 source-disclosure obligation (e.g. SaaS / closed distribution).

See [LICENSE](./LICENSE) for the full agreement. For a commercial license, contact [service@nonead.com](mailto:service@nonead.com).

`python/URBasic` (vendored) remains under its own **MIT License** (© Anthony Zhuang / Universal Robots, 2009-2025).
