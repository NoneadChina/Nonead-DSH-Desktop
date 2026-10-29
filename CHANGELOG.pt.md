<p align="center">
  <strong>Nonead DSH Desktop · Registro de alterações</strong><br>
  <sub><a href="CHANGELOG.md">中文</a> · <a href="CHANGELOG.en.md">English</a> · <a href="CHANGELOG.ja.md">日本語</a> · <a href="CHANGELOG.es.md">Español</a> · <a href="CHANGELOG.fr.md">Français</a> · <a href="CHANGELOG.de.md">Deutsch</a> · <a href="CHANGELOG.ru.md">Русский</a> · Português</sub>
</p>

# Registro de alterações

Este arquivo registra as mudanças do Nonead DSH Desktop que afetam os usuários. Cada versão eleva o número da versão nos dois workspaces de desktop (`nonead-dsh-desktop` e `dsh-plugin-desktop-beta`) de forma sincronizada; o número da versão também aparece nos nomes dos arquivos do instalador, na resposta do endpoint de atualização e no mapeamento das URLs de download direto, e os três precisam concordar.

Convenções de manutenção:

- Cada versão adiciona uma entrada por idioma (`CHANGELOG.md`, `CHANGELOG.en.md` e as versões ja/es/fr/de/ru/pt) e atualiza os hashes de blob do Git registrados em `CHANGELOG.i18n.yaml`, caso contrário `corepack yarn check:bilingual-docs` falha.
- As entradas registram apenas mudanças que os usuários percebem e mudanças de limite que os mantenedores precisam conhecer; refatorações puras não ganham entrada própria.
- O histórico anterior está nas tags do Git (`v1.7.3`, `v2.0.7`, `v2.0.8`, `v2.1.3`, `v2.1.4`, `v2.1.5`) e no log de commits.

## 2.2.3 — 2026-10-29

O shell do desktop foi localizado em oito idiomas (chinês simplificado, inglês, japonês, espanhol, francês, alemão, russo e português do Brasil):

- Textos do shell: foram adicionados dicionários em espanhol, francês, alemão, russo e português do Brasil, com 209 entradas cada, ao lado dos idiomas existentes; os diálogos nativos, o painel de permissões, o Computer Use, a página de Configurações, os controles de plugins e o rótulo do modo terminal resolvem todos por `desktopText`, e os menus nativos e o idioma da interface armazenado seguem o mesmo conjunto de oito idiomas.
- Página de Configurações: dicionários de configurações em seis idiomas (125 entradas cada) cobrem as seções de mercado de plugins, controle remoto, janela, navegador e rede local, e notificações, em vez de recorrer ao inglês.
- Textos com interpolação: onze diálogos (remoção e troca de Perfil, ativação/desativação/desinstalação de plugins, diretório de dados e estado da atualização) agora consultam modelos `{name}` e substituem o valor, então não recorrem mais ao inglês em seis idiomas.
- Processo de renderização: os textos de retorno da recuperação saíram do módulo que importa módulos nativos do Node, então a build native-ui não reporta mais avisos de externalização de `node:fs`/`node:path`/`node:crypto`.
- Limite: o assistente de recuperação e o seletor de Perfil ficam no workspace compartilhado `dsh-plugin-desktop-beta` e continuam apenas em chinês e inglês.
- Versão: o produto passa de 2.2.2 para **2.2.3** nos dois workspaces de desktop.
- Documentação: o README e o CHANGELOG agora também são publicados em japonês, espanhol, francês, alemão, russo e português do Brasil; o gate bilíngue agora aceita registros multilíngues (pelo menos dois documentos por registro).


## 2.2.2 — 2026-10-28

O runtime passa para o DSH `0.2.2-alpha.2` e o mercado para 1.73.1:

- Atualização do runtime: o canal beta salta de dsh `0.2.1-rc.3` para **`0.2.2-alpha.2`** (pin do submódulo `1f81c047` → `f3803c96`, commit upstream “release(dsh): 0.2.2-alpha.2”) — o runtime é reempacotado e vendorizado novamente (370 pacotes, contra 344), e todos os 24 patches de versão são reaplicados. Sete pacotes precisaram de nova ancoragem semântica porque a saída empacotada mudou: os nomes dos arquivos de bundle em `dsh`, `dsh-sandbox-windows-acl` e `dsh-web-frontend` trazem novos hashes; o `dsh-client-ui-plugin-manager` foi refatorado upstream para derivar `available` de `listed`, mas nunca o define (este patch restaura os slots do desktop e fornece essa definição); o `dsh-client-ui-settings-account` moveu o ícone de voltar do onboarding para uma variável de módulo; o `dsh-client-ui-directory-picker-browse` cresceu para nove dicionários de idioma; o `dsh-client-ui-primitives` mudou as tabelas largas para uma barra de rolagem visível apenas ao passar o mouse, e este patch a transforma de volta em uma barra fina sempre visível. O snapshot e os patches do runtime rc.3 permanecem como histórico.
- Superfície de dependências: `@deepseek-ai/cordis` passa para 4.0.6-alpha.1, `schemastery` para 3.18.6-alpha.1 e três pacotes de plugin do cordis sobem um alpha menor cada, caso contrário as verificações de peer do upstream 0.2.2-alpha.2 falham; o `nonead-dsh-desktop` é alinhado ao canal beta manualmente porque pertence à linha stable e está fora da lista de workspaces sincronizados automaticamente.
- Mercado: `dshmarket` 1.70.1 → **1.73.1**, com o patch do desktop (entrada de autoatualização, versões fornecidas pelo host, diff de linha de base do teste) reaplicado sobre 1.73.1; o upstream mudou o cache de atualização para a semântica `recheckAt`, então o trecho de `checkUpdates` é reescrito conforme o novo formato.
- Bridge do Agents Anywhere: reconstruído para as novas faixas de peer (artefato `rd9c47cbc`, pin inalterado em `39b82d4`), patch do connector intacto.
- Versão: o produto passa de 2.1.18 para **2.2.2** nos dois workspaces de desktop.

## 2.1.18 — 2026-10-24

Atualização do runtime upstream, uma build do Agents Anywhere a partir do código-fonte e uma build experimental para Windows ARM64 (inclui o lote de correções da auditoria da 2.1.17):

- Atualização do runtime upstream: o canal beta passou de dsh `0.2.1-rc.2` para **`0.2.1-rc.3`** (pin do submódulo `687f282e` → `1f81c047`): 24 patches versionados foram reaplicados sobre o rc.3, `vendor/dsh-runtime/0.2.1-rc.3/` foi vendorizado novamente (344 pacotes), e os manifestos raiz, os dois workspaces de desktop e as faixas de peer da bridge do Agents Anywhere acompanham; o snapshot e os patches do runtime rc.2 substituídos não são mais rastreados.
- Bridge do Agents Anywhere: agora **compilada a partir do código-fonte** (`39b82d4`, antes um artefato reutilizado) com o patch do connector reaplicado sobre o novo artefato — o relatório de saúde não bloqueia mais a publicação de notificações, a reescrita de IPv6 puro em `NO_PROXY` e o relatório de runtime pronto são mantidos, e a mudança do answer-provider substituída pela refatoração `interactionPeer(connection)` do upstream é descartada; os arquivos Python do artefato são normalizados para LF para que o patch se aplique de forma reproduzível.
- Windows ARM64 (experimental): um novo caminho de build `DSH_PACKAGE_ARCH=arm64` entrega um processo principal arm64 nativo, enquanto os runtimes Python / Node / Office embarcados reutilizam o payload x64 sob emulação do Windows; o empacotamento entre arquiteturas pula os smokes que só podem rodar no host, a build x64 e suas verificações não são afetadas, e este artefato ainda não está ligado aos links de download nem ao canal de atualização.
- Cartão de atualização em Configurações: a mensagem de falha do serviço agora diz “As atualizações do Nonead-DSH-Desktop estão temporariamente indisponíveis. Tente novamente mais tarde.”, em vez de citar o produto Next descontinuado; a barra de progresso do download foi movida entre o rótulo “Baixando atualização x%” e as notas da versão.

## 2.1.17 — 2026-10-24

Lote de correções da auditoria (26 correções, detalhadas abaixo):

- Assistente de recuperação: quando a exportação automática de diagnóstico e uma ação do usuário atualizavam o mesmo documento em paralelo, a primeira navegação falhava com `ERR_ABORTED`; no caminho sem ação do usuário, essa falha podia ser escalada pelo fail-loud para o encerramento completo do aplicativo. As atualizações agora são serializadas, uma navegação abortada pela destruição da janela é tratada como fim normal, e as falhas do caminho de ação são registradas apenas como diagnóstico.
- Leitura de checkpoints e degradação: os arquivos de manifesto e de backup são abertos e depois revalidados pelo inode (`O_NOFOLLOW` + `fstat`), então um caminho trocado entre `lstat` e a leitura não é mais confiável; um slot danificado não faz mais a lista inteira de snapshots falhar — ele é marcado como ilegível, permanece visível mas não restaurável na página de recuperação, e a rotação o reutiliza como próximo alvo de sobrescrita.
- Gravação de configurações: `settings.yaml` e o `pnpm-workspace.yaml` de um Perfil são publicados por meio de um arquivo temporário mais rename, então uma gravação interrompida deixa o conteúdo antigo ou o novo, em vez de meio YAML que perde todas as configurações na próxima inicialização.
- Atualizações: os corpos de resposta são liberados nos caminhos de limite de tamanho e de falha de decodificação; o macOS arma a transferência da instalação antes de o estágio nativo começar, então sair não apaga mais o pacote que o feed local ainda está servindo; escolher Sair em uma janela de recuperação aberta pelo usuário não é mais reportado como falha de inicialização (código de sucesso), enquanto falhas de inicialização continuam com código diferente de zero.
- Armazenamentos de plugins e de estado: as leituras de estado de plugin revalidam o inode; a recuperação de bloqueios de dados obsoletos tolera um `ENOENT` concorrente; a proteção contra estado danificado agora verifica o arquivo que ela realmente protege; as árvores de preparação do runtime deixadas por um crash são varridas antes da próxima publicação.
- Shell stable: o diálogo de resultado da verificação de atualização iniciada pela bandeja pertence à janela principal, então não pode mais ficar encoberto e perder a resposta; o interruptor do Computer Use trata `cancelled` como `failed`; o encerramento do guest do navegador tem limite (força após 1,5 s, depois 0,5 s de carência), o lease é liberado primeiro, e `browserRelease` não trava mais para sempre.
- Mercado da comunidade e skin: uma requisição de paginação interrompida não deixa mais o “carregar mais” preso em loading; a sobreposição do mercado devolve o foco ao fechar; o estilo injetado declara `data-plugin`, então um plugin carregado depois não pode mais reivindicá-lo e apagá-lo ao ser descarregado; a gramática de nomes de pacote corresponde à do Host.
- Gates e CI: o `upstream-command-windows` instala as dependências antes de `check:layout`; a classificação de mudanças desativa a detecção de renomeação, para que um arquivo de código-fonte renomeado para um caminho de documentação não pule os gates do produto; o teste de compatibilidade do inspector agora se ancora na raiz do repositório.
- Empacotamento: o `verify:safe-cleanup` do shell stable agora aponta o `TEMP` do processo filho do Electron para um diretório gravável do workspace (o Electron 44 neste host é recusado ao criar diretório em `%TEMP%`), então a pré-verificação não aborta mais antes de o instalador ser produzido.

## 2.1.16 — 2026-10-22

Reforço de segurança e correções de gates (o resultado de uma auditoria completa):

- A CI agora executa a classificação de mudanças e os gates de documentação/mercado a partir do **lado base do pull request**, então o código em revisão não pode mais enfraquecer seu próprio classificador para pular todos os gates do produto.
- Fuses do Electron reforçados: ambos os shells fecham a superfície de injeção de `NODE_OPTIONS` / `--inspect`; o shell stable (`asar: true`) agora carrega apenas de `app.asar`, enquanto o canal Beta mantém esse bit desligado porque distribui um diretório físico (`asar: false`). `runAsNode` precisa continuar ligado — no Windows, o Host, a CLI e os shims do pnpm iniciam o binário do Electron com `ELECTRON_RUN_AS_NODE`. Os dois scripts `verify-fuses` agora derivam o valor esperado do layout real e verificam o conjunto inteiro, então afrouxá-lo falha; o Stable antes chamava `verifyElectronExecutableFuses(path, undefined, false)`, que nunca verificava o bit do arquivo de forma alguma.
- A credencial do processo de renderização não viaja mais no ambiente do processo filho do Host; ela é injetada uma vez por um pipe privado na inicialização, então processos do mesmo usuário não podem lê-la do ambiente do processo ou de um dump de crash e se passar pelo renderer.
- O gate de acesso web agora **falha fechado** quando a credencial está ausente (antes falhava aberto); requisições de classe navegador não são mais permitidas silenciosamente.
- Deep links `dsh-desktop://` são despachados por uma lista de permissões de ações; ações desconhecidas são descartadas com uma única linha de log.
- A máscara de segredos para diagnósticos e logs agora cobre formatos base64url, então a credencial do processo de renderização não pode mais ser exportada.
- A rota do seletor de diretório compartilha a verificação de mesma origem por loopback usada pela rota de configurações, em vez de confiar em um `Origin` fornecido pelo cliente.

Empacotamento e lançamento:

- O contrato `asarUnpack` do shell stable foi comprovado novamente contra o app-builder-lib 26.15.7: as correspondências são resolvidas contra o **caminho do projeto de empacotamento**, então os três padrões precisam manter o prefixo `.desktop-build/payload/` de `files[].from` para corresponder (`scripts/node-bin`, `assets` e `build` de fato são desempacotados ao lado de `app.asar`). Os padrões permanecem como estão; um novo teste deriva o prefixo esperado de `files[].from` e o verifica, falhando se um dos lados se desviar — esse acoplamento não tinha nenhuma verificação antes.
- A CI ganhou cobertura de empacotamento do shell Stable, e o `verify-layout` agora impõe paridade de versão: a `version` dos dois workspaces precisa corresponder ao título mais recente do `CHANGELOG`.
- A CI não reescreve mais `dsh-plugin-desktop-beta/package.json` no lugar para pular o smoke do AA; um script `check:ci` explícito substitui essa mutação, então a CI e a execução local coincidem.

Higiene do repositório e cadeia de suprimentos:

- Todas as Actions de terceiros usadas pela CI estão fixadas em um SHA de commit (`actions/checkout`, `actions/setup-node`, `actions/cache`), com a tag mantida apenas como comentário final para legibilidade, então uma tag upstream movida não pode mudar silenciosamente o que os gates executam.
- O classificador de mudanças não trata mais todo arquivo em `docs/` como documentação: extensões que não são de documentação dentro de `docs/` (`.js`/`.mjs`/`.json`/`.ts` e afins) agora acionam os gates do produto, com isenção apenas para formatos reais de documentação e `docs/schemas/*.schema.json`.
- Seis arquivos tgz históricos sem referência (~1,7 MB) foram removidos de `vendor/agents-anywhere/`, mantendo apenas o fixado; o README desse diretório não ensina mais o caminho `DSH_AA_SOURCE_REF=pinned` removido e agora fixa por meio de `provenance.pinnedCommit`.
- Os arquivos `nonead-dsh-desktop/README.md` e `README.zh.md` não codificam mais a versão do produto (diziam `2.1.3`); eles apontam para a `version` do `package.json` e para a entrada mais recente do `CHANGELOG` raiz.
- A documentação agora declara que o AppImage e o deb de Linux x64 são construídos apenas pelo canal Beta e que o canal stable entrega um diretório executável no Linux; a primeira verificação real dos fuses e do `onlyLoadAppFromAsar` é o job `desktop-windows-stable` da CI (`package:dir:stable`), já que localmente apenas testes unitários os cobrem.

### Complemento de 2026-10-23 (mesmo número de versão, incluído nas builds seguintes)

Cadeia de empacotamento:

- Corrigidos três gates de empacotamento do Windows que se desviaram do comportamento real do produto: junctions criadas pelo pnpm dentro de um Perfil não podiam ser removidas recursivamente; o `verify:host` nunca passava a credencial do processo de renderização (32 bytes base64url, e precisa ser a mesma que o Host recebeu); e esse script se passava pelo renderer com uma string fixa, que o gate Web de falha fechada rejeita.
- O `dsh-plugin-desktop-beta` agora declara `@deepseek-ai/dsh-plugin-manager` (um peer obrigatório de `dsh-plugin-market`), restaurando o fechamento de 318 nós do runtime.

## 2.1.15 — 2026-10-22

A versão salta de `2.1.13` direto para `2.1.15`; não há um commit de release separado para `2.1.14` no histórico.

Runtime e dependências:

- O runtime do DSH permanece em **`0.2.1-rc.2`** e `channels.beta.commit` em `upstream.json` continua `687f282e`; a bridge do Agents Anywhere continua `39b82d4`.
- O mercado de plugins `dshmarket` sobe para `1.66.45` e o patch do desktop é reaplicado sobre ele.
- O patch de marca passou de `.yarn/patches/dsh-web-frontend-nonead-wordmark.patch` para `patches/dsh-web-frontend@0.2.1-rc.2.patch`, juntando-se aos outros patches do runtime.
- O patch httpx do connector do AA cresceu para cobrir o novo caminho de conexão.

Atualizações e recuperação:

- O cartão de atualização pode mostrar **notas da versão** fornecidas pela resposta de versão; o menu da bandeja e os diálogos nativos do canal Beta também oferecem uma entrada “ver notas completas da versão” (rótulos da bandeja e corpos de notificação são truncados pelas regras da plataforma), enquanto o diálogo nativo de atualização do canal stable ainda traz apenas texto fixo.
- **Pular esta versão** é novo: a decisão é persistida, então a verificação agendada sem supervisão não oferece mais uma versão pulada.
- Uma instalação que falhou pode ser tentada novamente, e a recuperação pode reverter para **qualquer snapshot salvo**, não apenas o mais recente.
- Iniciar o instalador nativo agora começa **antes** da sequência de saída, então sair não pode derrubar o instalador junto.
- A assinatura do instalador do Windows e a verificação do publicador foram introduzidas e depois **totalmente revertidas** em `c5896ac`; os instaladores do Windows ainda comparam apenas `ProductName` / `ProductVersion` do recurso de versão do PE.

Shell do desktop:

- A posição e o tamanho da janela são lembrados; a restauração só acontece enquanto a janela ainda se sobrepõe a um monitor montado, então desconectar um monitor não pode colocá-la fora da tela.
- O suporte estrito a arquivos `.env` em camadas preenche variáveis ausentes para o processo filho do Host sem sobrescrever o ambiente existente.
- Deep links `dsh-desktop://` são suportados (por exemplo `dsh-desktop://settings/general`).
- Um interruptor de iniciar ao ligar o computador lê o estado efetivo do sistema operacional.
- Os ciclos de leitura-modificação-gravação da configuração de Perfil agora rodam sob um único lock de escritor, então o shell e o profile manager do Host não podem mais descartar silenciosamente as atualizações um do outro.
- Os orçamentos de repetição da instância única e da limpeza de descartáveis são fixados em três; falhas não tratadas do processo de renderização aparecem na área de notificações.
- O `.env` e o ambiente de runtime do navegador guest são repassados corretamente.

Mercado e skin:

- O mercado pré-visualiza **mídia que não é imagem** e pode **instalar um plugin pelo nome**.
- Pular o mercado de plugins durante o onboarding é lembrado, e reabrir o assistente mantém a configuração de mercado armazenada.
- A troca do título hero da skin é limitada à subárvore hero e não toca mais em outros textos.

Correções:

- O fluxo de interação do AA mantém um peer vivo, e o runtime do DSH continua utilizável enquanto o histórico sincroniza.
- As asserções multiplataforma foram corrigidas e o bundle do mercado agora é distribuído com o pacote.
- A CI executa os gates do produto quando um JSON Schema do runtime muda.
- O fluxo de release deriva a versão distribuída a partir dos manifestos.

## 2.1.13 — 2026-10-21

Runtime e dependências:

- O runtime do DSH passou de `0.2.1-alpha.5` para **`0.2.1-rc.2`**: toda dependência `@deepseek-ai/dsh*` está fixada exatamente nessa versão, `vendor/dsh-runtime/0.2.1-rc.2/` é distribuído com o instalador, e o diretório antigo do runtime `alpha.5` não existe mais. O `upstream.json` registra `channels.beta.commit` = `687f282e`.
- O mercado de plugins `dshmarket` sobe para `1.66.44`.
- A bridge do Agents Anywhere sobe para `2.1.0-desktop` (upstream `39b82d4`) com o patch `agents-anywhere-connector-httpx`.

Interface e experiência:

- A tela de inicialização agora mostra o wordmark NONEAD / DEEPSEEK HARNESS.
- A página de conclusão do onboarding agora orienta a inserir uma chave de API e oferece uma entrada NONEAD.
- O onboarding habilita o mercado de plugins e o Computer Use por padrão (em vigor a partir da 2.1.12).

Estabilidade:

- A bridge do AA **descarta eventos** quando sua fila está cheia, em vez de travar.
- Corrigidas as asserções do PTC quebradas pela refatoração do rc.2 no upstream.
- A CI agora é acionada em `main` em vez de `master`.
- Removidos os arquivos `AGENTS.md`, `CLAUDE.md`, `PRIVACY*`, `CONTRIBUTING*` e `CODE_OF_CONDUCT*` da raiz; as regras do repositório agora vivem apenas em `README.md` e `docs/`.

## 2.1.12 — 2026-10-19

- O onboarding habilita o mercado de plugins (`dsh-market`) e o Computer Use por padrão, então novas instalações já têm ambos desde o primeiro lançamento.

## 2.1.11 — 2026-10-18

- Os dois workspaces de desktop unificados em `2.1.11`, com testes e documentação sincronizados.
- Manifestos raiz e documentação sincronizados com o DSH `0.2.1-rc.2` (após passar por `0.2.1-rc.1`).
- O `aa:prepare-release` agora pode usar uma árvore de código-fonte local em vez de um pack do GitHub, o que ajuda em releases offline ou com banda limitada.

## 2.1.6 — 2026-10-17

- Adicionado um patch de compatibilidade para plugins de Perfil, corrigindo o carregamento de plugins de perfil em runtimes mais novos.
- Os endpoints de download de atualização mudaram para `nonead.com`; o README ganhou instruções de instalação e execução do AppImage no Linux.

## 2.0.8 — 2026-10-11

- Os três canais unificados em `2.0.8`, com recursos de ícone atualizados, `dshmarket` e documentação de release.
- O runtime upstream já havia passado para `0.2.0-rc.2`.

## Problemas conhecidos

- A atualização no aplicativo no Linux apenas verifica a versão e nunca baixa um instalador; para atualizar, baixe um AppImage novo.
- Os instaladores do Windows ainda não são verificados criptograficamente: o caminho de download suporta um `installerSha256` do servidor, mas o endpoint de versão não o publica, então apenas `ProductName` e `ProductVersion` do recurso de versão do PE são comparados.
- Um submódulo `deepseek-harness` não inicializado faz `corepack yarn check:layout` falhar; builds normais, verificação de tipos e testes não são afetados.
