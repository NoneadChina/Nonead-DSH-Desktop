/**
 * One-off: rewrite the Windows ARM64 paragraph in every README so it matches the artifact
 * that can now be built (independent arm64 installer from the same dual-arch payload).
 * Literal replacement per language; fails loudly if a paragraph no longer matches.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const REWRITES = [
  {
    file: 'README.md',
    before: 'Windows ARM64 目前只提供**实验性构建**，不进入上面的下载链接与自动更新：主程序是原生 arm64，但内置的 Python / Node / Office 运行时仍是 x64 载荷（由 Windows 的仿真层执行），且尚未在 ARM 设备上完成运行验证。需要时按下文[常用命令](#dev)自行构建。',
    after: 'Windows ARM64 提供独立的 arm64 安装包（`Nonead-DSH-Desktop-<version>-arm64-Setup.exe`），与 x64 包共用同一份载荷：主程序为原生 arm64，内置的 Python / Node / Office 运行时仍是 x64 载荷（由 Windows 的仿真层执行）。该产物尚未在 ARM 设备上完成运行验证，因此暂不进入上面的下载链接与自动更新；构建命令见[常用命令](#dev)。',
  },
  {
    file: 'README.en.md',
    before: 'Windows ARM64 is available as an **experimental build only** and is not served by the download links or in-app updates above: the shell is native arm64, but the bundled Python / Node / Office runtime is still the x64 payload (executed through Windows emulation), and the artifact has not been run on ARM hardware yet. Build it yourself with the command under [Common commands](#dev).',
    after: 'Windows ARM64 has its own arm64 installer (`Nonead-DSH-Desktop-<version>-arm64-Setup.exe`) built from the same payload as the x64 package: the shell is native arm64, while the bundled Python / Node / Office runtime remains the x64 payload executed through Windows emulation. The artifact has not been validated on ARM hardware yet, so it is not served by the download links or in-app updates; see [Common commands](#dev) to build it.',
  },
  {
    file: 'README.ja.md',
    before: 'Windows ARM64 は現在**実験的なビルド**のみを提供しており、上記のダウンロードリンクと自動アップデートの対象外です。シェルはネイティブ arm64 ですが、同梱の Python / Node / Office ランタイムは x64 のペイロードのままで（Windows のエミュレーション層で実行）、ARM 実機での動作検証もまだ完了していません。必要な場合は、後述の[よく使うコマンド](#dev)に従ってご自身でビルドしてください。',
    after: 'Windows ARM64 には専用の arm64 インストーラー（`Nonead-DSH-Desktop-<version>-arm64-Setup.exe`）があり、x64 パッケージと同じペイロードからビルドされます。シェルはネイティブ arm64 ですが、同梱の Python / Node / Office ランタイムは引き続き x64 ペイロードで（Windows のエミュレーション層で実行）、ARM 実機での動作検証はまだ完了していないため、上記のダウンロードリンクと自動アップデートの対象外です。ビルド手順は[よく使うコマンド](#dev)を参照してください。',
  },
  {
    file: 'README.es.md',
    before: 'Windows ARM64 solo está disponible como **compilación experimental** y no se ofrece en los enlaces de descarga ni en las actualizaciones desde la aplicación anteriores: el shell es arm64 nativo, pero el runtime de Python / Node / Office incluido sigue siendo el paquete x64 (se ejecuta mediante la emulación de Windows) y el artefacto aún no se ha ejecutado en hardware ARM. Compílalo tú mismo con el comando de [comandos habituales](#dev).',
    after: 'Windows ARM64 dispone de su propio instalador arm64 (`Nonead-DSH-Desktop-<version>-arm64-Setup.exe`), compilado a partir del mismo paquete que la versión x64: el shell es arm64 nativo, mientras que el runtime de Python / Node / Office incluido sigue siendo el paquete x64 ejecutado mediante la emulación de Windows. El artefacto aún no se ha validado en hardware ARM, por lo que no se ofrece en los enlaces de descarga ni en las actualizaciones desde la aplicación; consulta [comandos habituales](#dev) para compilarlo.',
  },
  {
    file: 'README.fr.md',
    before: 'Windows ARM64 n’est disponible que sous forme de **build expérimental** et n’est ni proposé par les liens de téléchargement ni par les mises à jour intégrées ci-dessus : l’enveloppe est native arm64, mais les runtimes Python / Node / Office embarqués restent des charges utiles x64 (exécutées via l’émulation Windows), et l’artefact n’a pas encore été exécuté sur du matériel ARM. Pour le construire vous-même, utilisez la commande de la section [Commandes courantes](#dev).',
    after: 'Windows ARM64 dispose de son propre installateur arm64 (`Nonead-DSH-Desktop-<version>-arm64-Setup.exe`), construit à partir de la même charge utile que le paquet x64 : l’enveloppe est native arm64, tandis que les runtimes Python / Node / Office embarqués restent des charges utiles x64 exécutées via l’émulation Windows. L’artefact n’a pas encore été validé sur du matériel ARM ; il n’est donc ni proposé par les liens de téléchargement ni par les mises à jour intégrées. Voir [Commandes courantes](#dev) pour le construire.',
  },
  {
    file: 'README.de.md',
    before: 'Windows ARM64 ist **nur als experimenteller Build** verfügbar und wird nicht über die obigen Download-Links oder In-App-Updates ausgeliefert: Die Shell ist nativ für arm64 gebaut, die mitgelieferte Python-/Node-/Office-Laufzeit ist jedoch weiterhin die x64-Payload (ausgeführt über die Windows-Emulation), und das Artefakt wurde noch nicht auf ARM-Hardware ausgeführt. Bauen Sie es bei Bedarf selbst mit dem Befehl unter [Häufige Befehle](#dev).',
    after: 'Windows ARM64 hat einen eigenen arm64-Installer (`Nonead-DSH-Desktop-<version>-arm64-Setup.exe`), der aus derselben Payload wie das x64-Paket gebaut wird: Die Shell ist nativ für arm64 gebaut, die mitgelieferte Python-/Node-/Office-Laufzeit bleibt jedoch die x64-Payload, die über die Windows-Emulation ausgeführt wird. Das Artefakt wurde noch nicht auf ARM-Hardware validiert und wird daher nicht über die Download-Links oder In-App-Updates ausgeliefert; Bauanleitung unter [Häufige Befehle](#dev).',
  },
  {
    file: 'README.ru.md',
    before: 'Windows ARM64 доступен только как **экспериментальная сборка** и не раздаётся через ссылки для загрузки и автообновление выше: сама оболочка нативная arm64, но встроенная среда выполнения Python / Node / Office остаётся x64-полезной нагрузкой (исполняется через эмуляцию Windows), а артефакт ещё не проверялся на ARM-оборудовании. Соберите его самостоятельно командой из раздела [Обычные команды](#dev).',
    after: 'Для Windows ARM64 есть отдельный arm64-установщик (`Nonead-DSH-Desktop-<version>-arm64-Setup.exe`), собираемый из той же полезной нагрузки, что и пакет x64: оболочка нативная arm64, тогда как встроенная среда выполнения Python / Node / Office остаётся x64-полезной нагрузкой и исполняется через эмуляцию Windows. Артефакт ещё не проверялся на ARM-оборудовании, поэтому не раздаётся через ссылки для загрузки и автообновление; инструкция по сборке в разделе [Обычные команды](#dev).',
  },
  {
    file: 'README.pt.md',
    before: 'O Windows ARM64 está disponível apenas como **build experimental** e não é servido pelos links de download nem pelas atualizações no aplicativo acima: o shell é arm64 nativo, mas o runtime de Python / Node / Office embutido ainda é o payload x64 (executado pela emulação do Windows), e o artefato ainda não foi executado em hardware ARM. Compile você mesmo com o comando em [Comandos comuns](#dev).',
    after: 'O Windows ARM64 tem seu próprio instalador arm64 (`Nonead-DSH-Desktop-<version>-arm64-Setup.exe`), compilado a partir do mesmo payload do pacote x64: o shell é arm64 nativo, enquanto o runtime de Python / Node / Office embutido continua sendo o payload x64 executado pela emulação do Windows. O artefato ainda não foi validado em hardware ARM e, por isso, não é servido pelos links de download nem pelas atualizações no aplicativo; veja [Comandos comuns](#dev) para compilá-lo.',
  },
]

let changed = 0
for (const { file, before, after } of REWRITES) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes(before)) {
    console.error(`MISS ${file}: paragraph not found`)
    continue
  }
  writeFileSync(file, text.replace(before, after))
  changed += 1
  console.log(`ok   ${file}`)
}
console.log(`\nrewrote ${changed}/${REWRITES.length}`)
