<p align="center">
  <a href="https://www.nonead.com"><img src="https://www.nonead.com/assets/img/desktop-Nonead.jpg" alt="Nonead DSH Desktop：DeepSeek Harness を基盤に構築したオープンソースのデスクトップクライアント" width="100%"></a>
</p>

<h1 align="center">Nonead DSH Desktop</h1>

<p align="center">
  <strong>DeepSeek Harness を基盤に構築した、Windows・macOS・Linux 向けのオープンソースデスクトップクライアントです。</strong>
</p>

<p align="center">
  製品バージョン <code>2.2.3</code> · DSH ランタイム <code>0.2.2-alpha.2</code> · Electron 44 · MIT License
</p>

<h3 align="center"><a href="https://www.nonead.com">ワンクリックでダウンロード、すぐに使えます。</a></h3>

<p align="center">
  すべてが「プラグイン」で、デスクトップ自体も「プラグイン」です。
</p>

<p align="center"><sub>独立したコミュニティのオープンソースプロジェクトです。DeepSeek との間には、系列・提携・ライセンス・推薦のいずれの関係もありません。<br>本リポジトリには現在、DeepSeek の従業員も DeepSeek Harness 上流の公式チームのメンバーも参加していません。GitHub Contributors に表示される上流のコントリビューターは、fork を継承し同期されたコミット履歴によるものです。<br><a href="README.md">中文</a> · <a href="README.en.md">English</a> · 日本語 · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.pt.md">Português</a></sub></p>

<a id="toc"></a>

## 目次

| セクション | 内容 |
| --- | --- |
| [これは何か](#what) | 製品の位置づけとプロセスモデル |
| [現在のバージョンとランタイム](#versions) | バージョン、上流の pin、依存関係のベースライン |
| [ダウンロードとインストール](#download) | 3 つのプラットフォームでのインストール方法 |
| [主な機能](#features) | デスクトップシェル、プロファイル、マーケット、アップデート |
| [セキュリティ境界](#security) | レンダラーの認証情報、LAN、アップデートの検証 |
| [ドキュメント](#docs) | ユーザー向け・開発者向けの入口 |
| [リポジトリ構成](#layout) | ディレクトリと 4 つのワークスペースの役割 |
| [ソースからのビルド](#dev) | 環境、コマンド、ゲート |
| [リリースとアップデート](#release) | チャネルプロトコルとリリースの流れ |
| [プラグインエコシステム](#plugins) | なぜすべてがプラグインなのか |
| [上流との関係](#upstream) | 境界と役割分担 |
| [更新履歴](#changelog) | バージョンの変更履歴 |
| [既知の制限](#limits) | 事前に知っておきたい動作 |
| [コミュニティ](#community) | ディスカッションの窓口 |
| [リンク](#links) | エコシステムのプロジェクト |
| [License](#license) | ライセンスと表明 |

<a id="what"></a>

## これは何か

Nonead DSH Desktop は、[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) のローカル Web UI、Host サービス、プラグインシステムをネイティブデスクトップアプリに統合します。上流のソースは**そのまま**動作し、特定のリリースに固定されています。デスクトップシェルはウィンドウ、トレイ、ターミナル、自動アップデート、複数の作業プロファイル、インストーラーの配布を担い、さらに**それ自体が DSH プラグインとして組み込まれます**。サードパーティのプラグインと同じ構成メカニズムを使います。

本製品は「クライアントを作り直したもの」ではなく、薄い Electron ホストと完全な DSH ランタイムの組み合わせです：

| レイヤー | 位置 | 役割 |
| --- | --- | --- |
| デスクトップシェル | Electron main プロセス | 単一インスタンスロック、ウィンドウとマテリアル、トレイとメニュー、権限、ターミナル、アップデート、データディレクトリ、プロファイルの状態 |
| Host | Node モードの子プロセス | プロファイルのパッチ層を読み込み、上流のプロファイル boot を起動し、Web carrier を提供し、サードパーティの Host プラグインをホストする |
| Web carrier | ループバック HTTP + WebSocket | 公式 Web UI を提供する（既定では一時ポート） |
| レンダラー | サンドボックス化された BrowserWindow | 公式 Web UI を読み込み、ネイティブの認証情報ヘッダーで身元を識別する |

シェルと Host の間には子プロセス IPC チャネルが 1 本だけあります。プロファイルやモードを切り替えると Host generation 全体が破棄され、新しい子プロセスが起動します。generation をまたいで状態がキャッシュされることはありません。レンダラーは Electron API を直接受け取らず、公式 Web UI とシェルが生成したアクセス認証情報を受け取ります。

<a id="versions"></a>

## 現在のバージョンとランタイム

| 項目 | 値 |
| --- | --- |
| 製品バージョン | `2.2.3`（`nonead-dsh-desktop` と `dsh-plugin-desktop-beta` が同期） |
| 安定チャネルのワークスペース | `nonead-dsh-desktop`（ルートスクリプトは `:stable` 接尾辞） |
| Beta チャネルのワークスペース | `dsh-plugin-desktop-beta`（ルートスクリプトは `:beta` 接尾辞） |
| DSH ランタイム | `0.2.2-alpha.2`、すべての `@deepseek-ai/dsh*` 依存を厳密に pin し、ランタイムは vendored |
| vendored 済みランタイム | `vendor/dsh-runtime/0.2.2-alpha.2/`（過去バージョンのディレクトリもいくつか保持） |
| 上流の pin | `f3803c96974ad4a94195fb97e5c637e9c2a3afe3fc48fa190a683e469daa699857e9afe8`（`upstream.json` の `channels.beta`、`nonead-dsh-desktop/upstream-reference.json` にも記録） |
| Electron / パッケージャー | Electron `44.0.0` / electron-builder `26.15.7`（`app-builder-lib` にパッチあり） |
| Node / Yarn | Node `^22.19.0` または `>=24.0.0`、Yarn `4.18.0`（Corepack 経由、`nodeLinker: node-modules`） |
| プラグインマーケット | `dshmarket` `1.70.1`、加えて本リポジトリの `dsh-community-market` `0.1.0-dev.0` |
| スマートフォン遠隔操作ブリッジ | `@agents-anywhere/dsh-bridge-next` `2.1.0-desktop`（上流コミット `39b82d4`） |
| ブランドスキン | `dsh-nonead-client-skin`（インストーラーに同梱、プロファイルごとに組み込み読み込み） |

`upstream.json` は vendored された 2 本のランタイム系列を記録しています。`stable` は上流 `0.2.0-rc.2`、`beta` は上流 `0.2.2-alpha.2` に対応します。実際にインストーラーに含まれるのは、ワークスペースが厳密に pin している系列です。現在は 2 つのデスクトップワークスペースがともに `0.2.2-alpha.2` を pin しています。**チャネル名が表すのは「ランタイム系列」であり、ワークスペースが参照するリリースチャネルではありません。**

<a id="download"></a>

## ダウンロードとインストール

公式インストーラーは Windows x64、macOS（Universal、Intel と Apple Silicon を含む）、Linux x64（AppImage）に対応しています。追加の環境は不要で、ダウンロードしてインストールすればすぐに使えます。Linux x64 の AppImage と deb は Beta チャネルがビルドします。安定チャネルは Linux では実行可能なディレクトリ成果物のみを生成し、インストーラーは提供しません。

| プラットフォーム | ダウンロード | インストール方法 |
| --- | --- | --- |
| Windows x64 | [インストーラーをダウンロード](https://www.nonead.com/software/ndsh-desktop/downloads/windows) | NSIS インストーラーを実行し、画面の指示に従ってインストールします |
| macOS Universal | [DMG をダウンロード](https://www.nonead.com/software/ndsh-desktop/downloads/mac) | DMG を開き、Nonead DSH Desktop を Applications にドラッグします |
| Linux x64 | [AppImage をダウンロード](https://www.nonead.com/software/ndsh-desktop/downloads/linux) | 実行権限を付与してから実行します：`chmod +x Nonead-DSH-Desktop-*.AppImage && ./Nonead-DSH-Desktop-*.AppImage` |

Linux について：一部のディストリビューションでは先に FUSE のインストールが必要です。または `--appimage-extract-and-run` を付けて実行できます。Linux のアプリ内アップデートは**バージョンを確認するだけで、インストーラーをダウンロードしません**。アップグレードは新しい AppImage をダウンロードしてください。Linux 用インストーラーが必要な場合は Beta チャネルを使用してください（安定チャネルは Linux では実行可能なディレクトリ成果物のみを生成します）。

Windows ARM64 は現在**実験的なビルド**のみを提供しており、上記のダウンロードリンクと自動アップデートの対象外です。シェルはネイティブ arm64 ですが、同梱の Python / Node / Office ランタイムは x64 のペイロードのままで（Windows のエミュレーション層で実行）、ARM 実機での動作検証もまだ完了していません。必要な場合は、後述の[よく使うコマンド](#dev)に従ってご自身でビルドしてください。

詳しい手順、プロファイル、プラグインのコマンドは[ユーザーガイド](docs/user-guide.en.md)を、プラットフォームと利用範囲のご質問は[よくある質問](docs/faq.en.md)をご覧ください。

<a id="features"></a>

## 主な機能

| 機能 | 説明 |
| --- | --- |
| ネイティブデスクトップシェル | 単一インスタンスロック、ネイティブなウィンドウとメニュー、システムトレイ、Dock アイコン。ウィンドウのマテリアルはプラットフォームの機能に応じて制限されます（macOS は `off`/`transparent` に対応し既定は `transparent`、Linux は両方を受け付けますが常に `off` に解決、Windows は `off` のみ） |
| ローカル Host の管理 | シェルが自動的に Node モードで Host 子プロセスを spawn し、そのライフサイクルを管理します。まず正常終了を要求し、10 秒で終了しなければ `SIGTERM`、さらに 5 秒で終了しなければ `SIGKILL` を送ります。インストーラーの更新には正常終了が必要で、そうでなければインストールを拒否します |
| 公式 Web UI | 既定では `127.0.0.1` にのみバインドし、ポートはシステムが割り当てます。シェルは Host generation ごとに 32 バイトのランダムな認証情報を生成し、`x-dsh-desktop-renderer` ヘッダーで配布します |
| プロファイルと初回セットアップ | プロファイルのディレクトリは `$DSH_HOME/profiles/<name>` です。未初期化のプロファイルでは、初回起動時に Desktop 標準のセットアップウィザード（ウィンドウモードとマテリアル、プラグインマーケット、通知、システムの既定ブラウザーで開くかどうか、Web アクセスの範囲）を表示し、完了またはスキップした後に Host を起動します |
| ブラウザーと LAN アクセス | 「ブラウザーで開く」はシステムのブラウザーを自動で起動するかどうかだけを制御し、公開範囲は変わりません。LAN アクセスは独立したスイッチで、有効にすると現在利用可能な LAN の URL を表示します |
| 組み込みプラグインマーケット | DSH Community Market は「発見 / インストール可能 / インストール済み / ソース」の 4 つのビューを提供し、拡張可能なカタログソースと審査済みのアダプターに対応します |
| ブランドスキン | `dsh-nonead-client-skin` はインストーラーに同梱され、Profile によってすべてのプロファイルに既定で読み込まれます。個別のインストールは不要です |
| 自動アップデート | 固定のバージョンチェックを `https://www.nonead.com/software/ndsh-desktop/version` に対して行い、現在のバージョン、チャネル、ランダムなインストール識別子を送信します。Windows / macOS はダウンロードしてインストールし、Linux は確認のみ行います |
| アップデートの体験 | アップデートカードにはサーバーが配信するリリースノートを表示し、Beta チャネルではトレイメニューとネイティブダイアログに「完全なリリースノートを見る」入口を追加します。「このバージョンをスキップ」は設定が永続化されるため、無人での定期チェックで再度提示されることはありません。インストールに失敗した場合は再試行でき、保存済みの任意のスナップショットにロールバックできます |
| ウィンドウとセッションの状態 | ウィンドウの位置とサイズを記憶します。復元時にはウィンドウがマウント済みのディスプレイと交差しているかを検証するため、外付けモニターを外してもウィンドウが画面外に復元されることはありません |
| ディープリンクと自動起動 | `dsh-desktop://` ディープリンクに対応しています。たとえば `dsh-desktop://settings/general` で設定画面を直接開けます。自動起動のスイッチは OS の実際の状態を読み取ります |
| 環境変数ファイル | 厳密な `.env` のレイヤリングに対応し、Host 子プロセスに不足している変数だけを補い、既存の環境を上書きしません |
| マーケットの強化 | プラグインマーケットは画像以外のメディアのプレビューに対応し、名前を指定してプラグインをインストールできます |
| ターミナルと作業ディレクトリ | デスクトップシェルはターミナル機能と作業ディレクトリの選択を提供し、Desktop サービスとしてプラグインに公開します |
| 実験的な機能 | onboarding ではプラグインマーケットと Computer Use が既定で有効になります。音声、翻訳、Agent Team、Ralph などはランタイムに同梱されています |

<a id="security"></a>

## セキュリティ境界

| 境界 | 実際の動作 |
| --- | --- |
| レンダラーの身元 | 現在の generation の認証情報（`x-dsh-desktop-renderer`）を伴うリクエストだけが Electron レンダラーとして扱われます。通常のブラウザーアクセスを無効にすると、それ以外のリクエストは 403 を返し、既存のブラウザー WebSocket も主動的に切断されます |
| レンダラー認証情報の受け渡し | 認証情報はメインプロセスと Host プロセスのメモリにのみ存在します。Host は起動時に**専用の stdin** で 1 行を受け取り、直後にパイプを閉じます。そのため子プロセスの環境変数、argv、ファイルのいずれにも入りません（旧実装は環境変数に置いていたため、同一ユーザーのプロセスがプロセス環境やクラッシュダンプから読み取り、レンダラーになりすませました） |
| Web アクセスのゲート | Host が認証情報を持たない場合、ブラウザー側のリクエストは**フェイルクローズ**（拒否）となり、警告を 1 件記録します。fail-open での通過は行いません。`/connect` のログイン交換と読み取り専用リクエストはコード内の注記に従って除外され、Market のルートは読み取りでも接続認証情報を必要とします |
| LAN アクセス | **認証はありません**。同じ LAN 内の誰でも、ポートに到達できれば DSH を開いてこのコンピューターを操作できます。完全に信頼できるネットワークでのみ有効にしてください |
| インストーラーの検証 | ダウンロード経路はサーバーが公開する `installerSha256` に対応し、厳格なゲートとして適用しますが、現在のバージョンエンドポイントはまだこのフィールドを公開していません。それまでの間、Windows は PE のバージョンリソースにある `ProductName` と `ProductVersion` のみを検証し、macOS はバンドル識別子、埋め込み manifest、コード署名、Team Identifier を検証します。この身元検証は安定シェルにのみ存在し、Beta シェルのダウンロード側はインストーラーのマジックバイトとサイズだけを検証してから実行します |
| プラグイン側の設定ミス | パッチの `id` が一致しない場合は `entry not found` を記録してスキップします。`name` が一致しない場合は `name mismatch ... skipping` を記録します。しかし `inject` のサービス名を間違えても**エラーにはなりません**。そのプラグインは永久に pending のままで、UI 上は原因不明の HTTP 4xx として現れます |

<a id="docs"></a>

## ドキュメント

一般のユーザーは[ユーザーガイド](docs/user-guide.en.md)から始めれば十分です。開発者向けドキュメントは、拡張や保守が必要なときだけ読めば足ります。完全な索引は[ドキュメント索引](docs/README.en.md)にあります。

### ユーザー向けドキュメント

| 目的 | 入口 |
| --- | --- |
| インストール、プロファイル、モード、ターミナル、プラグインコマンド、アップデート | [ユーザーガイド](docs/user-guide.en.md) |
| 対応プラットフォーム、同梱環境、データ、プラグイン、アップデートについての直接の回答 | [よくある質問](docs/faq.en.md) |
| このプロジェクトが存在する理由を知る | [なぜ Nonead DSH Desktop なのか](docs/why-desktop.en.md) |
| バージョンの変更履歴を見る | [更新履歴](CHANGELOG.ja.md) |

### 開発者・メンテナー向けドキュメント

| 目的 | 入口 |
| --- | --- |
| デスクトップシェル、Host 子プロセス、Web carrier、パッケージングの関係 | [アーキテクチャ](docs/architecture.en.md) |
| 通常のプラグインまたは Desktop プラグインを書く | [プラグイン開発](docs/plugin-development.en.md) |
| プラグインエコシステムの提言を読む | [DSH プラグインエコシステム提言](docs/plugin-ecosystem.en.md) |
| `desktopProfiles` / `desktopPnpm` などの Desktop サービスを使う | [デスクトッププラグインインターフェース](dsh-plugin-desktop-beta/docs/plugin-services.md) |
| 統一プラグイン contract の議論に参加する | [DSH Community Fabric Draft](dsh-community-fabric/README.md) |
| プラグインマーケットの製品・セキュリティ設計を見る | [DSH Community Market](dsh-community-market/README.md) |
| パッケージ単位のビルド、リリース、既知の制限を調べる | [`dsh-plugin-desktop-beta/README.md`](dsh-plugin-desktop-beta/README.md) |
| 安定チャネルのワークスペースにある独立したシェルについて知る | [`nonead-dsh-desktop/README.md`](nonead-dsh-desktop/README.md) |
| ブランドスキンのプラグインを見る | [`dsh-nonead-client-skin/README.md`](dsh-nonead-client-skin/README.md) |

<a id="layout"></a>

## リポジトリ構成

ルートは Yarn `4.18.0` の workspace（`nodeLinker: node-modules`）で、メンバーと役割は次のとおりです：

| パス | 役割 |
| --- | --- |
| `nonead-dsh-desktop/` | 安定チャネルのデスクトップワークスペース：独立したシェル（プロファイルと復旧、window controls、onboarding）、Agents Anywhere bridge と Community Market のアダプター、Electron bootstrap とパッケージング |
| `dsh-plugin-desktop-beta/` | Beta チャネルのデスクトップワークスペース：Cordis Host / Client の両面、Electron bootstrap、packaging とリリーステスト |
| `dsh-community-market/` | 組み込みプラグインマーケットの製品・セキュリティ設計、catalog provider contract、テストとビルド |
| `dsh-community-fabric/` | コミュニティ相互運用 RFC：Manifest/Capability、Runtime/Presentation、service composition、来歴診断の提案 |
| `dsh-nonead-client-skin/` | インストーラーとともに配布されるブランドスキン。`file:` 依存で取り込まれ、ルートの workspace 一覧には含まれません |
| `vendor/dsh-runtime/<version>/` | チャネルごとに vendored された DSH ランタイムパッケージと `manifest.json` |
| `vendor/agents-anywhere/` | Agents Anywhere bridge の vendored パッケージ |
| `patches/` | Yarn パッチ：Electron パッケージャー、pnpm、`open`、`fs-ext`、DSH サブプロセスなど |
| `scripts/` | ルートのゲートとリリーススクリプト（バイリンガルドキュメント、マーケットの依存方向、vendored runtime、アイコン、layout、AA リリース） |
| `docs/` | 製品ドキュメント。`docs/evidence/` にはリリースとインストーラーに関する実測記録を保存 |
| `deepseek-harness/` | 上流の読み取り専用サブモジュール。pin は `upstream.json` の `channels.beta.commit` と一致 |

**サブモジュールは日常的な開発には必須ではありません**：ランタイムは vendored 済みのため、`corepack yarn install`、`build`、`typecheck`、`test`、`dev:*`、`dist:*` にサブモジュールは不要です。必要なのは `upstream:*` スクリプト（ランタイムの再ビルドと再パッケージ）だけです。一方、`corepack yarn check:layout` はサブモジュールの commit と作業ツリーの状態を検証するため、未初期化のクローンでは必ず失敗します。これは想定どおりの動作です。

<a id="dev"></a>

## ソースからのビルド

### 環境要件

- Node.js `^22.19.0` または `>=24.0.0`
- ルートの Yarn `4.18.0`（Corepack 経由。pnpm や npm でルートの依存関係をインストールしないでください）
- Git。上流のサブモジュールを初期化してランタイムを再ビルドする場合にのみ必要です

```sh
git clone https://github.com/NoneadChina/Nonead-DSH-Desktop.git
cd Nonead-DSH-Desktop
corepack yarn install
corepack yarn dev:beta     # Beta ワークスペース
# corepack yarn dev:stable # 安定チャネルのワークスペース（nonead-dsh-desktop）
```

上流のソースが実際に必要な場合は次を実行します：

```sh
git submodule update --init --recursive
```

### よく使うコマンド

| コマンド | 目的 |
| --- | --- |
| `corepack yarn dev:beta` / `dev:stable` | 対象ワークスペースの開発フローを開始します（固定された `dshmarket` の検証、AA 成果物の準備、マーケットのビルドを先に行います） |
| `corepack yarn build` | マーケット、Beta ワークスペース、安定チャネルのワークスペースをビルドします（同じく `dshmarket` の固定バージョンを先に検証します） |
| `corepack yarn typecheck` | 3 つのワークスペースの型チェック |
| `corepack yarn test` | 3 つのワークスペースのユニットテスト |
| `corepack yarn check` | 完全な headless ゲート：layout、アーキテクチャの方向性、vendored runtime、バイリンガルドキュメント、AA connector、各ワークスペースの check |
| `corepack yarn check:ci` | CI が実際に実行するチェーン：`check` と同じですが、Beta ワークスペースは `check:ci` を使い（上流側で停止中の `verify:aa` を外します）、CI 内で manifest を書き換えません |
| `corepack yarn check:layout` | ワークスペースのトポロジー、厳密な pin、サブモジュール、vendored runtime、アイコン / レイアウトのゲート |
| `corepack yarn check:bilingual-docs` | `*.i18n.yaml` に記録された Git blob ハッシュが対応するドキュメントと一致するかを検証 |
| `corepack yarn check:vendored-runtime` | `vendor/dsh-runtime/` が `upstream.json` と一致するかを検証 |
| `corepack yarn market:prepare` / `market:check` | `market:prepare` は `dshmarket` を npm の `latest` に移動します（変更対象は 2 つのデスクトップ workspace の `resolutions` / 依存関係と `yarn.lock` のみ）。`market:check` はすべてのビルドが実行するオフラインの整合性チェックで、ネットワークに接続するのは `--latest` を付けたときだけです |
| `corepack yarn aa:prepare-release` / `aa:check` | Agents Anywhere のリリース成果物をビルドまたは検証 |
| `corepack yarn package:dir:beta` | パッケージ化前のアプリケーションディレクトリを生成 |
| `corepack yarn dist:win:beta` / `dist:mac:beta` / `dist:win-portable:beta` | 対象プラットフォームのリリース成果物を生成 |
| `DSH_PACKAGE_ARCH=arm64 corepack yarn dist:win:stable` | Windows ARM64 の実験的なインストーラーを生成（既定は x64。クロスアーキテクチャでビルドすると、このホストでしか実行できないスモークテストはスキップされます） |

規約：

- ルートの `build`、`dev:*`、`dist:*` は最初に `corepack yarn market:check` を実行します。これはコミット済みの `dshmarket` のバージョン、lockfile、互換性パッチが一致しているかをオフラインで検証し、ネットワークにも接続せず manifest も書き換えません。pin を移動する場合は、人が `corepack yarn market:prepare` を実行し、バージョン、lockfile、パッチをまとめてコミットする必要があります。
- `nonead-dsh-desktop` と `dsh-plugin-desktop-beta` は**2 つの独立したワークスペース**です。共通の変更は両方に反映しつつ、それぞれが宣言している差異を保つ必要があります。リリース前に `corepack yarn check` と両ワークスペースそれぞれの check を実行してください。
- `README*.md` や `CHANGELOG*.md` をいずれかの言語で編集した後は、対応する `*.i18n.yaml` の Git blob ハッシュを更新してください（`git hash-object` で取得します）。更新しないと `check:bilingual-docs` が失敗します。
- `corepack yarn check:layout` には初期化済みのサブモジュールが必要です。完全な headless 環境でビジネスコードだけを検証する場合は、`typecheck` / `test` / 各ワークスペースの `check` を個別に実行してください。
- **CI はレビュー対象のコードに実行内容を決めさせてはいけません**：`changes` ジョブは `scripts/` を **PR のベース**側に復元してから分類器とドキュメント / マーケットのゲートを実行します（ドキュメントは作業ツリーから取得）。`workflow_dispatch` にはベースがないため、警告を出したうえで head 側のコピーにフォールバックします。CI は実行時に `dsh-plugin-desktop-beta/package.json` を書き換えるのではなく、`corepack yarn check:ci`（= ローカルの `check` から `verify:aa` を除いたもの）を実行します。
- **バージョンの一致もゲートの一部です**：`scripts/verify-layout.mjs` は両ワークスペースの `version` が `CHANGELOG.md` の最新の `## <バージョン> — <日付>` 見出しと等しいことを要求するため、リリース時にどちらかを直し忘れると失敗します。

<a id="release"></a>

## リリースとアップデート

- **2 種類の成果物**：2 つのデスクトップワークスペースがそれぞれ生成します。Beta と安定チャネルではインストーラーの識別子、成果物のプレフィックス、アップデートチャネルが異なるため、混在させないでください。
- **チャネルプロトコル**：バージョンチェックは `https://www.nonead.com/software/ndsh-desktop/version` に対して行い、`X-DSH-Desktop-Version` で現在のバージョン、`X-DSH-Desktop-Channel` で `stable` / `beta`、`X-DSH-Desktop-Installation-Id` でローカルに生成・永続化したランダム UUID を送信します。インストーラーのダウンロードには `channel` と `X-DSH-Desktop-Target-Version` を含めますが、インストール識別子や現在のバージョンは含めません。
- **チャネルの検証**：サーバーの応答はチャネルをそのまま返す必要があります。安定チャネルは正式な SemVer のみ、Beta チャネルは `-beta.N` のみを受け付け、クライアントがチャネルをまたいで暗黙にダウンロードすることはありません。
- **バージョンの一致**：アップロードした成果物、素のダウンロード URL の「バージョン → ファイル」の対応、バージョンエンドポイントが報告するバージョンの 3 つがすべて一致している必要があります。一致しない場合は誤ったバージョンがインストールされるのではなく 404 になります。
- **リリースの前提**：先に `corepack yarn aa:prepare-release` を実行してください。今回のリリースで新しい `dshmarket` を含める場合は、さらに人が `corepack yarn market:prepare` を実行してコミットする必要があります。Windows の配布コマンドは `--verify-release` で AA 成果物も検証します。

<a id="plugins"></a>

## プラグインエコシステム

プラグインは DSH に機能を追加する拡張パッケージです。モデル、ツール、UI、ワークフローはどれもプラグインとして作れ、積み木のように組み合わせられます。Nonead DSH Desktop は上流のソースを変更しておらず、固定されたシェルでもありません。固定バージョンの上流がそのまま動作し、デスクトップシェル自体が DSH プラグインとして組み込まれ、「すべてがプラグイン」という同じルールで 1 つのランタイムに構成されます。

プラグイン作者が気にする必要があるのは次の 3 点だけです：

1. **通常の DSH プラグイン**は、どの DSH 環境でも同じように開発できます。[プラグイン開発](docs/plugin-development.en.md)をご覧ください。
2. **Desktop サービス**（`desktopProfiles`、`desktopPnpm` など）を使うと、プラグインがプロファイルを参照・切り替えたり、プラグインのインストール・アップデート・削除を行えます。[デスクトッププラグインインターフェース](dsh-plugin-desktop-beta/docs/plugin-services.md)をご覧ください。
3. **構成とパッチ**：プロファイルの構成はパッチ層の積み重ねで、`id` は既存の行に一致し、`insert` は新しい行を追加します。前の節「[セキュリティ境界](#security)」にある「間違えても静かに無効になる」3 つの挙動に注意してください。

エコシステム共創のビジョンと 3 つの原則は[DSH プラグインエコシステム提言](docs/plugin-ecosystem.en.md)に、統一プラグイン contract に関するコミュニティ提案は [Community Fabric](dsh-community-fabric/README.md) にあります。

<a id="upstream"></a>

## 上流との関係

Nonead DSH Desktop は、[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) と Cordis のプラグイン思想を基盤に構築された独立したコミュニティプロジェクトで、**Nonead Corporation** が開発・保守しています。

上流はコアとなるエージェント機能、プラグインシステム、Web UI、ランタイムパッケージを提供します。本リポジトリが担うのは次のとおりです：

- デスクトップアプリのパッケージング（Electron メインプロセス、ウィンドウ、トレイ、メニュー、マテリアル）
- ローカル Host サービスの起動、停止、復旧、クラッシュ時のフォールバック
- プロファイルとパッチ層、初回セットアップウィザード、ブラウザー / LAN アクセスの制御
- プラグインマーケットとブランドスキンの同梱配布
- Windows / macOS / Linux のビルド、署名、リリースフロー、および自動アップデート

コマンドラインから DeepSeek Harness を使いたいだけの場合や、そのコア開発に参加したい場合は、上流のリポジトリを直接ご覧ください。

<a id="changelog"></a>

## 更新履歴

完全な変更履歴は[更新履歴](CHANGELOG.ja.md)（[中文](CHANGELOG.md)）にあります。最近のリリース：

| バージョン | 日付 | ポイント |
| --- | --- | --- |
| `2.1.15` | 2026-10-22 | アップデートカード / トレイ / ネイティブダイアログでのリリースノート表示、バージョンのスキップ、インストール失敗時の再試行とスナップショットへのロールバック。ウィンドウ位置の記憶、`.env` のレイヤリング、`dsh-desktop://` ディープリンク、自動起動。マーケットの非画像メディアプレビューと名前指定インストール。`dshmarket` `1.66.45` |
| `2.2.3` | 2026-10-29 | デスクトップシェルが 8 言語（中・英・日・西・仏・独・露・伯葡）に完全ローカライズ：5 言語分のシェル辞書と 6 言語分の設定ページ辞書を追加し、補間を含むダイアログはテンプレートによる参照に変更、クライアントのロケール名前空間とネイティブメニューも同じ 8 言語に追随 |
| `2.2.2` | 2026-10-28 | ランタイムを DSH `0.2.2-alpha.2` に移動（370 パッケージを再 vendored、24 個のバージョンパッチとマーケットパッチをリベース）、dshmarket を 1.73.1 に移動、Agents Anywhere bridge を新しい peer 範囲に合わせて再ビルド |
| `2.1.18` | 2026-10-24 | ランタイムを DSH `0.2.2-alpha.2` に移動（344 パッケージを再 vendored、24 個のパッチをリベース）、Agents Anywhere bridge をソースからビルドし connector パッチをリベース、Windows ARM64 の実験的ビルドを追加、アップデートカードの文言と進捗表示の位置を修正。2.1.17 のレビュー修正バッチを含む |
| `2.1.17` | 2026-10-24 | レビュー修正バッチ：復旧アシスタントの更新競合、チェックポイントの inode 再確認と単一スロットへの縮退、設定のアトミック書き込み、アップデート失敗経路の解放、プラグイン状態と staging のクリーンアップ、トレイダイアログの所有権、マーケットのページングとスキン宣言、CI ゲートの修正 |
| `2.1.16` | 2026-10-22 | セキュリティとゲートの修正：CI ゲートが PR ベース側のスクリプトで実行、Electron fuses の厳格化（`NODE_OPTIONS`/`--inspect` を無効化、安定シェルは `app.asar` からのみ読み込み。`runAsNode` は Host/CLI/pnpm shim が必要とするため維持し、レイアウト由来のアサーションで固定）、レンダラー認証情報を専用パイプで注入、Web ゲートをフェイルクローズに変更、ディープリンクのアクション許可リスト、base64url の秘密マスク。安定シェルの `asarUnpack` と `files[].from` の結合はプレフィックス導出のテストで固定（既存の pattern が正しいことを実測で確認）、安定シェルのパッケージング CI を追加、`verify-layout` がバージョン一致を強制 |
| `2.1.13` | 2026-10-21 | ランタイムを DSH `0.2.1-rc.2` に切り替え、`dshmarket` `1.66.44`、AA bridge `39b82d4`、新しい boot ワードマークと onboarding の API Key 取得ガイド、キュー溢れ時に AA イベントを破棄してクラッシュしないよう修正 |

<a id="limits"></a>

## 既知の制限

- **Linux のアプリ内アップデートはバージョンを確認するだけ**で、インストーラーをダウンロードしません。アップグレードには新しい AppImage をダウンロードしてください。
- **Windows ARM64 は実験的なビルド**です：`dist:win:stable` は既定で x64 インストーラーのみを生成します。arm64 には `DSH_PACKAGE_ARCH=arm64` が必要です（併せて `DSH_PACKAGE_OUTPUT_DIR` で出力先を分けることを推奨します）。シェルはネイティブ arm64 ですが、同梱ランタイムは x64 のペイロードのままで（Windows のエミュレーション）、クロスアーキテクチャでビルドすると実行を伴うスモークテストはスキップされます。また、アップデートチャネルは現在単一の `windows` 成果物しか持たないため、x64 と arm64 を同時に配信できません。
- **Windows インストーラーはまだ暗号学的なダイジェスト検証を行っていません**：ダウンロード経路はサーバーの `installerSha256` に対応していますが、現在のバージョンエンドポイントはこのフィールドを公開していないため、当面は `ProductName` / `ProductVersion` のみを比較します（安定シェルのみ。Beta シェルはインストーラーのマジックバイトとサイズだけを検証してから実行します）。
- **LAN アクセスには認証がありません** — 同じネットワークセグメントの全員に、このコンピューターの DSH を引き渡すことになります。
- **プラグインの `inject` サービス名を間違えると静かに pending になります** — 警告は出ず、関連する API の 4xx としてのみ現れます。
- ローカルでの `yarn install` により、`yarn.lock` にある `dsh-nonead-client-skin` の内容フィンガープリントが書き換わることがあります（マシン間で再現できません）。**このようなローカル生成の lockfile 変更はコミットしないでください**。

<a id="community"></a>

## コミュニティ

- Discord：[Nonead DSH Desktop コミュニティに参加](https://discord.gg/TJeGqKRNM)
- 企業 WeChat と QQ グループ：参加後に @王博升Benson へダイレクトメッセージするか、メールで参加方法をお問い合わせください
- 技術チームへの参加をご希望の方：[t4wefan@qq.com](mailto:t4wefan@qq.com) までご連絡ください

<a id="links"></a>

## リンク

DeepSeek Harness エコシステムのプロジェクトと開発者ツール：

| プロジェクト | 概要 | リンク |
| --- | --- | --- |
| dshfind | DeepSeek Harness（DSH）の学習・共有コミュニティ。 | [GitHub](https://github.com/hikariming/dshfind) · [公式サイト](https://dshfind.com) |
| DSH 1024Store | DSH エコシステム向けのコミュニティプラグインカタログ。オンラインプラグインマーケット、カタログパイプライン、公開クエリ API もオープンソース化しています。 | [GitHub](https://github.com/imsai-sh/awesome-deepseek-harness-plugins) |
| Awesome DSH Plugin | DeepSeek Harness（DSH）のプラグイン厳選リスト。 | [GitHub](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) |
| dsh-market | DSH 内のビジュアルなプラグインマーケット。閲覧、検索、ワンクリックインストールに対応。 | [GitHub](https://github.com/dsh-market/dsh-market) |
| ModLens | DSH とテキストベースのコーディングエージェントに OCR、レイアウト、セマンティック認識を提供。 | [GitHub](https://github.com/liustack/modlens) |
| DeepSeek Harness オレンジブック | DeepSeek Harness コミュニティによる実測ハンドブック。 | [GitHub](https://github.com/alchaincyf/deepseek-harness-orange-book) |
| dsh-web-ui | DeepSeek Harness Web UI のプラグインとスキンのコレクション。 | [GitHub](https://github.com/zhu1090093659/dsh-web-ui) |
| dsh-TUI | DeepSeek Harness の全画面インタラクティブターミナル UI。 | [GitHub](https://github.com/ccch1mneyyy/dsh-TUI) |
| dsh-context | DSH のコンテキスト可視化パネル：Context ダッシュボード、`/context` コマンド、ブラウザー。 | [GitHub](https://github.com/bowenliang123/dsh-context) |
| Agents-Anywhere | スマートフォンからパソコン上のコーディングエージェントを遠隔操作。 | [GitHub](https://github.com/anywhere-labs/Agents-Anywhere) |
| DSH-better-sidebar | DSH のサイドバーワークベンチ。ファイル、ターミナル、Git、サブエージェントを統合。 | [GitHub](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Awesome DeepSeek Harness | DSH のプラグイン、ツール、インフラの厳選リスト。 | [GitHub](https://github.com/0xsline/awesome-deepseek-harness) |

<a id="license"></a>

## License

Copyright © 2026 **Nonead Corporation**。本プロジェクトは [MIT License](LICENSE) に基づいて公開されています。

> "DeepSeek Harness" は DeepSeek の登録商標です。この名称は、互換性、技術的な由来、および上流ソフトウェアとの関係を正確に説明する目的でのみ使用しています。

> 本プロジェクトは完全に無料のオープンソースです。本ソフトウェアが有償で販売されているのを見かけても、取引をお断りください。

> Nonead DSH Desktop は独立したコミュニティプロジェクトであり、DeepSeek との間に系列・提携・ライセンス・推薦の関係はありません。
