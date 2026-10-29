<p align="center">
  <a href="https://www.nonead.com"><img src="https://www.nonead.com/assets/img/desktop-Nonead.jpg" alt="Nonead DSH Desktop, um cliente desktop de código aberto criado sobre o DeepSeek Harness" width="100%"></a>
</p>

<h1 align="center">Nonead DSH Desktop</h1>

<p align="center">
  <strong>Um cliente desktop de código aberto para Windows, macOS e Linux, criado sobre o DeepSeek Harness.</strong>
</p>

<p align="center">
  Produto <code>2.2.3</code> · runtime do DSH <code>0.2.2-alpha.2</code> · Electron 44 · Licença MIT
</p>

<h3 align="center"><a href="https://www.nonead.com">Download em um clique, pronto para usar.</a></h3>

<p align="center">
  Tudo é um plugin — inclusive o próprio desktop.
</p>

<p align="center"><sub>Um projeto de código aberto independente da comunidade. Não possui vínculo de subordinação, parceria, licenciamento ou endosso com a DeepSeek.<br>Atualmente, nenhum funcionário da DeepSeek ou membro da equipe oficial do DeepSeek Harness upstream participa deste repositório; os colaboradores upstream exibidos no GitHub Contributors vêm do histórico de commits herdado por fork e sincronização.<br><a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · Português</sub></p>

<a id="toc"></a>

## Índice

| Seção | Conteúdo |
| --- | --- |
| [O que é isto](#what) | Posicionamento do produto e modelo de processos |
| [Versões e runtime](#versions) | Versões, pin upstream, linha de base de dependências |
| [Download e instalação](#download) | Instalação nas três plataformas |
| [Recursos](#features) | Shell desktop, perfis, mercado, atualizações |
| [Limites de segurança](#security) | Credencial do renderer, LAN, verificação de atualizações |
| [Documentação](#docs) | Pontos de entrada para usuários e desenvolvedores |
| [Estrutura do repositório](#layout) | Diretórios e os quatro workspaces |
| [Compilar a partir do código-fonte](#dev) | Ambiente, comandos, verificações |
| [Lançamento e atualizações](#release) | Protocolo de canais e fluxo de lançamento |
| [Ecossistema de plugins](#plugins) | Por que tudo é um plugin |
| [Relação com o upstream](#upstream) | Limites e divisão de trabalho |
| [Registro de alterações](#changelog) | Histórico de versões |
| [Limitações conhecidas](#limits) | Comportamentos que vale conhecer antes |
| [Comunidade](#community) | Canais de discussão |
| [Links](#links) | Projetos do ecossistema |
| [Licença](#license) | Licença e avisos |

<a id="what"></a>

## O que é isto

O Nonead DSH Desktop traz a interface Web local, o serviço Host e o sistema de plugins do [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) para um aplicativo desktop nativo. O código-fonte upstream roda **sem modificações** e fica fixado em uma versão de lançamento específica; o shell desktop é responsável por janelas, bandeja, terminal, atualização automática, múltiplos perfis de trabalho e empacotamento, e **ele mesmo é montado como um plugin do DSH** pelo mesmo mecanismo de composição usado por plugins de terceiros.

O produto não é uma reimplementação do cliente — é um host Electron enxuto mais um runtime DSH completo:

| Camada | Local | Responsabilidade |
| --- | --- | --- |
| Shell desktop | Processo principal do Electron | Bloqueio de instância única, janelas e materiais, bandeja e menus, permissões, terminal, atualizações, diretório de dados, estado do perfil |
| Host | Processo filho em modo Node | Carrega a camada de patches do perfil, inicia o boot do perfil upstream, serve o carrier Web, hospeda plugins Host de terceiros |
| Carrier Web | HTTP + WebSocket em loopback | Serve a interface Web oficial (porta efêmera por padrão) |
| Renderer | BrowserWindow em sandbox | Carrega a interface Web oficial e é identificado por um cabeçalho de credencial nativo |

Shell e Host se comunicam por exatamente um canal IPC de processo filho. Trocar um perfil ou modo descarta toda a geração do Host e cria um novo processo filho; nenhum estado é armazenado entre gerações. O renderer nunca recebe APIs do Electron — ele recebe a interface Web oficial mais uma credencial de acesso gerada pelo shell.

<a id="versions"></a>

## Versões e runtime

| Item | Valor |
| --- | --- |
| Versão do produto | `2.2.3` (`nonead-dsh-desktop` e `dsh-plugin-desktop-beta` em sincronia) |
| Workspace do canal estável | `nonead-dsh-desktop` (os scripts da raiz usam o sufixo `:stable`) |
| Workspace do canal Beta | `dsh-plugin-desktop-beta` (os scripts da raiz usam o sufixo `:beta`) |
| Runtime do DSH | `0.2.2-alpha.2`, todas as dependências `@deepseek-ai/dsh*` com pin exato, runtime vendorizado |
| Runtime vendorizado | `vendor/dsh-runtime/0.2.2-alpha.2/` (vários diretórios de versões históricas são mantidos) |
| Pin upstream | `f3803c96974ad4a94195fb97e5c637e9c2a3afe3fc48fa190a683e469daa699857e9afe8` (`channels.beta` no `upstream.json`, replicado em `nonead-dsh-desktop/upstream-reference.json`) |
| Electron / empacotador | Electron `44.0.0` / electron-builder `26.15.7` (`app-builder-lib` com patch) |
| Node / Yarn | Node `^22.19.0` ou `>=24.0.0`; Yarn `4.18.0` via Corepack (`nodeLinker: node-modules`) |
| Mercado de plugins | `dshmarket` `1.70.1`, além do `dsh-community-market` `0.1.0-dev.0` deste repositório |
| Ponte de controle remoto | `@agents-anywhere/dsh-bridge-next` `2.1.0-desktop` (commit upstream `39b82d4`) |
| Skin da marca | `dsh-nonead-client-skin` (distribuída no instalador, montada por perfil) |

O `upstream.json` registra duas linhas de runtime vendorizado: `stable` mapeia para o upstream `0.2.0-rc.2` e `beta` para o upstream `0.2.2-alpha.2`. O que realmente vai dentro de um instalador é a linha que o workspace fixa exatamente — hoje os dois workspaces desktop fixam `0.2.2-alpha.2`. **Nomes de canal descrevem linhas de runtime, não o canal de lançamento que um workspace consulta.**

<a id="download"></a>

## Download e instalação

Os instaladores oficiais cobrem Windows x64, macOS (Universal, Intel e Apple Silicon) e Linux x64 (AppImage). Nenhum ambiente extra é necessário. O AppImage e o deb para Linux x64 são gerados pelo canal Beta; o canal estável só produz um diretório executável no Linux, não um instalador.

| Plataforma | Download | Instalação |
| --- | --- | --- |
| Windows x64 | [Baixar o instalador](https://www.nonead.com/software/ndsh-desktop/downloads/windows) | Execute o instalador NSIS e siga as instruções |
| macOS Universal | [Baixar o DMG](https://www.nonead.com/software/ndsh-desktop/downloads/mac) | Abra o DMG e arraste o Nonead DSH Desktop para Aplicativos |
| Linux x64 | [Baixar o AppImage](https://www.nonead.com/software/ndsh-desktop/downloads/linux) | Torne-o executável e execute: `chmod +x Nonead-DSH-Desktop-*.AppImage && ./Nonead-DSH-Desktop-*.AppImage` |

Notas para Linux: algumas distribuições precisam do FUSE instalado, ou você pode executar com `--appimage-extract-and-run`. A atualização no aplicativo no Linux **apenas verifica a versão e nunca baixa um instalador**; para atualizar, baixe um AppImage novo. Use o canal Beta quando precisar de um instalador para Linux — o canal estável só produz um diretório executável no Linux.

O Windows ARM64 está disponível apenas como **build experimental** e não é servido pelos links de download nem pelas atualizações no aplicativo acima: o shell é arm64 nativo, mas o runtime de Python / Node / Office embutido ainda é o payload x64 (executado pela emulação do Windows), e o artefato ainda não foi executado em hardware ARM. Compile você mesmo com o comando em [Comandos comuns](#dev).

O uso passo a passo, os perfis e os comandos de plugins estão no [guia do usuário](docs/user-guide.en.md); dúvidas sobre plataformas e escopo são respondidas nas [Perguntas frequentes](docs/faq.en.md).

<a id="features"></a>

## Recursos

| Recurso | Descrição |
| --- | --- |
| Shell desktop nativo | Bloqueio de instância única, janelas e menus nativos, bandeja do sistema, ícone no Dock; os materiais da janela dependem da capacidade da plataforma (o macOS aceita `off`/`transparent` e usa `transparent` por padrão, o Linux aceita ambos mas sempre resolve para `off`, o Windows apenas `off`) |
| Gerenciamento local do Host | O shell cria o processo filho Host e controla seu ciclo de vida: encerramento gracioso primeiro, `SIGTERM` após 10 s, `SIGKILL` após mais 5; instalar atualizações exige encerramento gracioso e é recusado caso contrário |
| Interface Web oficial | Vincula apenas `127.0.0.1`, porta efêmera por padrão; o shell gera uma credencial aleatória de 32 bytes por geração do Host e a entrega via `x-dsh-desktop-renderer` |
| Perfis e configuração inicial | Os diretórios de perfil ficam em `$DSH_HOME/profiles/<name>`; um perfil não inicializado mostra primeiro o assistente de configuração do Desktop (modo e material da janela, mercado de plugins, notificações, abertura no navegador padrão, escopo de acesso Web) antes de o Host iniciar |
| Acesso pelo navegador e pela LAN | “Abrir no navegador” só controla se o navegador do sistema é aberto e não muda a exposição; o acesso pela LAN é uma opção separada que também mostra a URL atual da LAN |
| Mercado de plugins integrado | O DSH Community Market oferece as visualizações de descoberta / instaláveis / instalados / fontes, com fontes de catálogo extensíveis e adaptadores revisados |
| Skin da marca | `dsh-nonead-client-skin` acompanha o instalador e é montada pelo Perfil para cada perfil, sem instalação separada |
| Atualização automática | Verificação de versão fixa em `https://www.nonead.com/software/ndsh-desktop/version` com a versão atual, o canal e um id de instalação aleatório; Windows e macOS baixam e instalam, o Linux apenas verifica |
| Experiência de atualização | O cartão de atualização mostra as notas de versão fornecidas pela resposta de versão, e o menu da bandeja e os diálogos nativos do canal Beta acrescentam uma entrada “ver notas de versão completas”; “ignorar esta versão” é persistido para que uma verificação agendada sem supervisão não a ofereça de novo; uma instalação com falha pode ser repetida e revertida para qualquer snapshot salvo |
| Estado da janela e da sessão | Lembra a posição e o tamanho da janela; uma posição salva só é restaurada enquanto ainda se sobrepõe a um monitor conectado, então desconectar um monitor não restaura a janela fora da tela |
| Links diretos e item de login | Links `dsh-desktop://` são suportados, por exemplo `dsh-desktop://settings/general` abre as configurações diretamente; a opção de iniciar ao entrar lê o estado efetivo do sistema operacional |
| Arquivo de ambiente | O suporte estrito a `.env` em camadas preenche variáveis ausentes do processo filho Host e nunca sobrescreve o ambiente existente |
| Melhorias no mercado | O mercado de plugins pré-visualiza mídia que não é imagem e pode instalar um plugin pelo nome |
| Terminal e diretório de trabalho | O shell expõe recursos de terminal e de diretório de trabalho como serviços do Desktop para plugins |
| Recursos experimentais | O onboarding ativa por padrão o mercado de plugins e o Computer Use; fala, tradução, Agent Team e Ralph vêm com o runtime |

<a id="security"></a>

## Limites de segurança

| Limite | Comportamento real |
| --- | --- |
| Identidade do renderer | Apenas requisições que carregam a credencial da geração atual (`x-dsh-desktop-renderer`) contam como o renderer do Electron; com o acesso pelo navegador desativado, toda outra requisição recebe 403 e os WebSockets de navegador existentes são derrubados |
| Transporte da credencial do renderer | A credencial vive apenas na memória do processo principal e do Host; o Host recebe uma linha pelo seu **stdin privado** na inicialização e o pipe fecha imediatamente, então ela nunca entra no ambiente do processo filho, em argv ou em um arquivo (a implementação antiga usava uma variável de ambiente, que processos do mesmo usuário podiam ler do ambiente do processo ou de um despejo de memória para se passar pelo renderer) |
| Controle de acesso Web | Quando o Host não tem credencial, ele **nega por padrão** requisições da classe navegador e registra um aviso em vez de permiti-las; a troca de login em `/connect` e as requisições somente leitura são isentas no código, e as rotas do Market precisam de credencial de conexão mesmo para leitura |
| Acesso pela LAN | **Sem autenticação**: qualquer pessoa na mesma rede que alcance a porta pode abrir o DSH e operar esta máquina. Ative apenas em redes totalmente confiáveis |
| Verificação do instalador | O caminho de download suporta um `installerSha256` publicado pelo servidor e o aplica como verificação obrigatória, mas o endpoint de versão ainda não publica esse campo; até lá, o Windows verifica apenas `ProductName` e `ProductVersion` do recurso de versão do PE, enquanto o macOS verifica a identidade do bundle, o manifesto embutido, a assinatura de código e o Team Identifier; essa verificação de identidade só existe no shell estável, enquanto o caminho de download do shell Beta verifica apenas os bytes mágicos e o tamanho do instalador antes de executá-lo |
| Configuração incorreta de plugin | Um `id` de patch que não corresponde a nada registra `entry not found` e é ignorado; um `name` divergente registra `name mismatch ... skipping`; mas um nome de serviço `inject` errado **não gera erro** — o plugin fica pendente para sempre e a interface apenas mostra HTTP 4xx inexplicável |

<a id="docs"></a>

## Documentação

Usuários comuns podem começar pelo [guia do usuário](docs/user-guide.en.md); a documentação para desenvolvedores importa apenas ao estender ou manter o projeto. O índice completo está no [índice da documentação](docs/README.en.md).

### Documentação do usuário

| Objetivo | Ponto de entrada |
| --- | --- |
| Instalar, perfis, modos, terminal, comandos de plugins e atualizações | [Guia do usuário](docs/user-guide.en.md) |
| Respostas diretas sobre plataformas, ambiente embutido, dados, plugins e atualizações | [Perguntas frequentes](docs/faq.en.md) |
| Entender por que o projeto existe | [Por que Nonead DSH Desktop](docs/why-desktop.en.md) |
| Ler o histórico de versões | [Registro de alterações](CHANGELOG.pt.md) |

### Documentação para desenvolvedores e mantenedores

| Objetivo | Ponto de entrada |
| --- | --- |
| Shell, processo filho Host, carrier Web e empacotamento | [Arquitetura](docs/architecture.en.md) |
| Escrever plugins comuns ou plugins Desktop | [Desenvolvimento de plugins](docs/plugin-development.en.md) |
| Ler a proposta do ecossistema de plugins | [Proposta de ecossistema de plugins do DSH](docs/plugin-ecosystem.en.md) |
| Usar `desktopProfiles` / `desktopPnpm` e outros serviços do Desktop | [Serviços de plugins do Desktop](dsh-plugin-desktop-beta/docs/plugin-services.md) |
| Participar da discussão do contrato unificado de plugins | [DSH Community Fabric Draft](dsh-community-fabric/README.md) |
| Ler o design de produto e de segurança do mercado | [DSH Community Market](dsh-community-market/README.md) |
| Build, lançamento e limitações conhecidas no nível do pacote | [`dsh-plugin-desktop-beta/README.md`](dsh-plugin-desktop-beta/README.md) |
| O workspace do shell do canal estável | [`nonead-dsh-desktop/README.md`](nonead-dsh-desktop/README.md) |
| O plugin da skin da marca | [`dsh-nonead-client-skin/README.md`](dsh-nonead-client-skin/README.md) |

<a id="layout"></a>

## Estrutura do repositório

A raiz é um workspace Yarn `4.18.0` (`nodeLinker: node-modules`) com os seguintes membros e responsabilidades:

| Caminho | Responsabilidade |
| --- | --- |
| `nonead-dsh-desktop/` | Workspace desktop do canal estável: shell próprio (perfis e recuperação, controles de janela, onboarding), ponte Agents Anywhere e adaptadores do Community Market, bootstrap do Electron e empacotamento |
| `dsh-plugin-desktop-beta/` | Workspace desktop do canal Beta: faces duplas Host/Client, bootstrap do Electron, empacotamento e testes de lançamento |
| `dsh-community-market/` | Design de produto e de segurança do mercado de plugins integrado, contrato de provedor de catálogo, testes e build |
| `dsh-community-fabric/` | RFC de interoperabilidade da comunidade: Manifest/Capability, Runtime/Presentation, composição de serviços e diagnósticos de proveniência |
| `dsh-nonead-client-skin/` | Skin da marca distribuída com o instalador, trazida por uma dependência `file:` e fora da lista de workspaces da raiz |
| `vendor/dsh-runtime/<version>/` | Pacotes do runtime DSH vendorizados por canal e `manifest.json` |
| `vendor/agents-anywhere/` | Pacotes vendorizados da ponte Agents Anywhere |
| `patches/` | Patches do Yarn para o empacotador do Electron, pnpm, `open`, `fs-ext`, subprocesso do DSH e mais |
| `scripts/` | Scripts de verificação e de lançamento da raiz (documentos bilíngues, direção de dependências do mercado, runtime vendorizado, ícones, layout, lançamento AA) |
| `docs/` | Documentação do produto; `docs/evidence/` guarda registros medidos de lançamento e de instalador |
| `deepseek-harness/` | Submódulo upstream somente leitura, fixado em `channels.beta.commit` no `upstream.json` |

**O submódulo não é necessário para o desenvolvimento diário.** O runtime é vendorizado, então `corepack yarn install`, `build`, `typecheck`, `test`, `dev:*` e `dist:*` não precisam dele; apenas os scripts `upstream:*` (recompilar e reempacotar o runtime) precisam. Já `corepack yarn check:layout` verifica o commit e a árvore de trabalho do submódulo, então necessariamente falha em um clone não inicializado — isso é esperado.

<a id="dev"></a>

## Compilar a partir do código-fonte

### Requisitos

- Node.js `^22.19.0` ou `>=24.0.0`
- Yarn `4.18.0` na raiz via Corepack (não instale as dependências da raiz com pnpm ou npm)
- Git; necessário apenas para inicializar o submódulo upstream ao recompilar o runtime

```sh
git clone https://github.com/NoneadChina/Nonead-DSH-Desktop.git
cd Nonead-DSH-Desktop
corepack yarn install
corepack yarn dev:beta     # workspace Beta
# corepack yarn dev:stable # workspace do canal estável (nonead-dsh-desktop)
```

Quando você realmente precisar do código-fonte upstream:

```sh
git submodule update --init --recursive
```

### Comandos comuns

| Comando | Finalidade |
| --- | --- |
| `corepack yarn dev:beta` / `dev:stable` | Inicia o fluxo de desenvolvimento do workspace (verifica o `dshmarket` fixado, prepara artefatos AA e compila o mercado primeiro) |
| `corepack yarn build` | Compila o mercado, o workspace Beta e o workspace do canal estável (também verifica o `dshmarket` fixado primeiro) |
| `corepack yarn typecheck` | Verificação de tipos dos três workspaces |
| `corepack yarn test` | Testes unitários dos três workspaces |
| `corepack yarn check` | Verificação headless completa: layout, direção da arquitetura, runtime vendorizado, documentos bilíngues, conector AA, verificações por workspace |
| `corepack yarn check:ci` | A cadeia que a CI realmente executa: igual a `check`, mas o workspace Beta usa `check:ci` (descarta o `verify:aa` pausado pelo upstream) em vez de reescrever o manifesto dentro da CI |
| `corepack yarn check:layout` | Topologia de workspaces, pins exatos, submódulo, runtime vendorizado, ícones e verificações de layout |
| `corepack yarn check:bilingual-docs` | Verifica se os hashes de blob Git registrados em `*.i18n.yaml` correspondem aos documentos |
| `corepack yarn check:vendored-runtime` | Verifica `vendor/dsh-runtime/` em relação a `upstream.json` |
| `corepack yarn market:prepare` / `market:check` | `market:prepare` move o `dshmarket` para o `latest` do npm (apenas `resolutions`/dependências dos dois workspaces desktop e `yarn.lock`); `market:check` é a verificação de consistência offline que todo build executa, e só `--latest` acessa a rede |
| `corepack yarn aa:prepare-release` / `aa:check` | Gera ou verifica artefatos de lançamento do Agents Anywhere |
| `corepack yarn package:dir:beta` | Produz um diretório de aplicação não empacotado |
| `corepack yarn dist:win:beta` / `dist:mac:beta` / `dist:win-portable:beta` | Produz artefatos de lançamento da plataforma |
| `DSH_PACKAGE_ARCH=arm64 corepack yarn dist:win:stable` | Produz um instalador experimental para Windows ARM64 (x64 por padrão; um build de arquitetura cruzada pula os smokes que só podem rodar neste host) |

Convenções:

- `build`, `dev:*` e `dist:*` da raiz executam `corepack yarn market:check` primeiro: ele verifica offline que a versão commitada do `dshmarket`, o lockfile e o patch de compatibilidade concordam, sem acessar a rede nem reescrever manifestos. Mover o pin exige que uma pessoa execute `corepack yarn market:prepare` e faça commit da versão, do lockfile e do patch juntos.
- `nonead-dsh-desktop` e `dsh-plugin-desktop-beta` são **workspaces separados**: mudanças compartilhadas devem entrar nos dois, preservando as diferenças declaradas; execute `corepack yarn check` e a verificação de cada workspace antes do lançamento.
- Depois de editar `README*.md` ou `CHANGELOG*.md` em qualquer idioma, atualize os hashes de blob Git no `*.i18n.yaml` correspondente (obtenha-os com `git hash-object`), caso contrário `check:bilingual-docs` falha.
- `corepack yarn check:layout` precisa de um submódulo inicializado; em um ambiente puramente headless, valide o código de negócio com `typecheck` / `test` / `check` por workspace.
- **A CI não pode deixar o código em revisão decidir o que roda**: o job `changes` restaura `scripts/` da **base do pull request** antes de executar o classificador e as verificações de documentação/mercado (os documentos ainda vêm da árvore de trabalho); `workflow_dispatch` não tem base, então recua para a cópia head com um aviso. A CI executa `corepack yarn check:ci` (= `check` local sem `verify:aa`) em vez de reescrever `dsh-plugin-desktop-beta/package.json` em tempo de execução.
- **A paridade de versão faz parte da verificação**: `scripts/verify-layout.mjs` exige que o `version` dos dois workspaces seja igual ao título mais recente `## <version> — <date>` do `CHANGELOG.md`, então esquecer qualquer lado em um lançamento falha.

<a id="release"></a>

## Lançamento e atualizações

- **Duas linhas de produto**: produzidas pelos dois workspaces desktop. Os instaladores Beta e estável diferem em bundle id, prefixo de artefato e canal de atualização e não devem ser misturados.
- **Protocolo de canal**: a verificação de versão solicita `https://www.nonead.com/software/ndsh-desktop/version`, informando a versão atual em `X-DSH-Desktop-Version`, `stable` / `beta` em `X-DSH-Desktop-Channel` e um UUID aleatório gerado e persistido localmente em `X-DSH-Desktop-Installation-Id`. Os downloads do instalador carregam `channel` e `X-DSH-Desktop-Target-Version`, mas nunca o id de instalação ou a versão atual.
- **Exigência de canal**: a resposta do servidor deve repetir o canal; o canal estável aceita apenas SemVer simples enquanto o canal Beta aceita apenas `-beta.N`, e o cliente nunca baixa silenciosamente entre canais.
- **Consistência de versão**: o artefato enviado, o mapeamento versão-para-arquivo da URL de download direta e a versão informada pelo endpoint devem coincidir — uma divergência aparece como 404 em vez de uma instalação errada.
- **Pré-requisitos de lançamento**: execute `corepack yarn aa:prepare-release` primeiro; se este lançamento trouxer um novo `dshmarket`, uma pessoa também deve executar `corepack yarn market:prepare` e fazer commit. Os comandos de distribuição para Windows ainda verificam artefatos AA com `--verify-release`.

<a id="plugins"></a>

## Ecossistema de plugins

Plugins estendem o DSH — modelos, ferramentas, interface e fluxos de trabalho são todos plugins que se compõem como peças de montar. O Nonead DSH Desktop não modifica o código-fonte upstream e não é um shell codificado: o upstream fixado roda como está, e o próprio shell desktop se conecta pela mesma regra de “tudo é um plugin”.

Para autores de plugins, bastam três coisas:

1. **Plugins DSH comuns** são desenvolvidos exatamente como em qualquer ambiente DSH — veja [desenvolvimento de plugins](docs/plugin-development.en.md).
2. **Serviços do Desktop** (`desktopProfiles`, `desktopPnpm`, …) permitem que plugins inspecionem ou troquem perfis e instalem, atualizem ou removam plugins — veja [serviços de plugins do Desktop](dsh-plugin-desktop-beta/docs/plugin-services.md).
3. **Composição e patches**: um perfil é composto empilhando camadas de patch, onde `id` corresponde a uma linha existente e `insert` acrescenta novas linhas; atenção aos três modos de falha “silenciosamente inertes” em [Limites de segurança](#security).

A visão e os três princípios estão na [proposta de ecossistema de plugins do DSH](docs/plugin-ecosystem.en.md); a proposta da comunidade para um contrato unificado de plugins é o [Community Fabric](dsh-community-fabric/README.md).

<a id="upstream"></a>

## Relação com o upstream

O Nonead DSH Desktop é um projeto independente da comunidade criado sobre o [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) e o modelo de plugins Cordis, desenvolvido e mantido pela **Nonead Corporation**.

O upstream fornece as capacidades centrais de agente, o sistema de plugins, a interface Web e os pacotes de runtime. Este repositório é responsável por:

- Empacotamento do aplicativo desktop (processo principal do Electron, janelas, bandeja, menus, materiais)
- Iniciar, parar e recuperar o serviço Host local, incluindo fallbacks para falhas
- Perfis e camadas de patch, o assistente de primeira execução, controle de acesso pelo navegador e pela LAN
- Distribuir o mercado de plugins e a skin da marca dentro do instalador
- Builds, assinatura e fluxo de lançamento para Windows / macOS / Linux, e atualização automática

Se você só quer usar o DeepSeek Harness pela linha de comando, ou quer trabalhar no núcleo dele, vá ao repositório upstream.

<a id="changelog"></a>

## Registro de alterações

O histórico completo está no [registro de alterações](CHANGELOG.pt.md) ([中文](CHANGELOG.md)). Lançamentos recentes:

| Versão | Data | Destaques |
| --- | --- | --- |
| `2.1.15` | 2026-10-22 | Notas de versão no cartão de atualização, na bandeja e nos diálogos nativos, ignorar uma versão, nova tentativa de instalação e reversão por snapshot; estado de janela lembrado, `.env` em camadas, links diretos `dsh-desktop://` e iniciar ao entrar; pré-visualização de mídia no mercado e instalação pelo nome; `dshmarket` `1.66.45` |
| `2.2.3` | 2026-10-29 | O shell desktop está totalmente localizado em oito idiomas (chinês, inglês, japonês, espanhol, francês, alemão, russo e português brasileiro): cinco novos dicionários do shell mais dicionários da página de configurações em seis idiomas, consultas baseadas em template para diálogos com interpolação, e o namespace de locale do cliente e os menus nativos seguem o mesmo conjunto |
| `2.2.2` | 2026-10-28 | Runtime movido para DSH `0.2.2-alpha.2` (370 pacotes re-vendorizados, 24 patches de versão e o patch do mercado rebaseados), dshmarket vai para 1.73.1, e a ponte Agents Anywhere é reconstruída para os novos intervalos de peer |
| `2.1.18` | 2026-10-24 | Runtime movido para DSH `0.2.2-alpha.2` (344 pacotes re-vendorizados, 24 patches rebaseados), a ponte Agents Anywhere é compilada do código-fonte com um patch de conector rebaseado, um build experimental para Windows ARM64 entra, e o texto do cartão de atualização e o posicionamento do progresso são corrigidos; inclui o lote de correções de auditoria 2.1.17 |
| `2.1.17` | 2026-10-24 | Lote de correções de auditoria: corrida de atualização do assistente de recuperação, reverificações de inode de checkpoint e degradação para slot único, gravações atômicas de configurações, liberação no caminho de falha de atualização, limpeza de estado de plugin e de staging, propriedade de diálogos da bandeja, paginação do mercado e declaração de skin, correções nas verificações de CI |
| `2.1.16` | 2026-10-22 | Correções de segurança e das verificações: as verificações de CI executam o classificador do lado base, fuses do Electron apertados (`NODE_OPTIONS`/`--inspect` fechados, o Stable carrega apenas de `app.asar`; `runAsNode` mantido porque os shims do Host/CLI/pnpm precisam dele, e agora fixado por asserções derivadas do layout), credencial do renderer injetada por pipe privado, controle web nega por padrão, lista de permissões de ações de link direto, mascaramento de segredo base64url; o acoplamento `asarUnpack` / `files[].from` do shell Stable agora é fixado por um teste que deriva o prefixo (os padrões existentes verificados como corretos), CI de empacotamento do Stable adicionada, e `verify-layout` agora exige paridade de versão |
| `2.1.13` | 2026-10-21 | Runtime movido para DSH `0.2.1-rc.2`, `dshmarket` `1.66.44`, ponte AA `39b82d4`, nova wordmark de boot e orientação de API key no onboarding, a fila AA descarta eventos em vez de travar quando transborda |

<a id="limits"></a>

## Limitações conhecidas

- **A atualização no aplicativo no Linux apenas verifica a versão** e nunca baixa um instalador; para atualizar, baixe um AppImage novo.
- **O Windows ARM64 é distribuído como build experimental**: `dist:win:stable` produz apenas o instalador x64 por padrão; arm64 exige `DSH_PACKAGE_ARCH=arm64` (combine com `DSH_PACKAGE_OUTPUT_DIR` para um diretório de saída separado). O shell é arm64 nativo enquanto o runtime embutido permanece no payload x64 (emulação do Windows), um build de arquitetura cruzada pula os smokes de execução, e o canal de atualização atualmente carrega um único artefato `windows`, então não pode servir x64 e arm64 lado a lado.
- **Os instaladores do Windows ainda não são verificados criptograficamente**: o caminho de download suporta um `installerSha256` do servidor, mas o endpoint de versão não o publica, então apenas `ProductName` / `ProductVersion` são comparados por enquanto (somente shell Stable; o shell Beta verifica apenas os bytes mágicos e o tamanho do instalador, depois o executa).
- **O acesso pela LAN não tem autenticação** — ele entrega o DSH desta máquina a todos no mesmo segmento de rede.
- **Um nome de serviço `inject` errado em um plugin falha silenciosamente** como um plugin permanentemente pendente, aparecendo apenas como HTTP 4xx.
- Um `yarn install` local pode reescrever a impressão digital de conteúdo do `dsh-nonead-client-skin` no `yarn.lock` (não reproduzível entre máquinas); **não faça commit dessas mudanças locais de lockfile**.

<a id="community"></a>

## Comunidade

- Discord: [entre na comunidade Nonead DSH Desktop](https://discord.gg/TJeGqKRNM)
- WeChat Work e grupos QQ: envie mensagem para @王博升Benson após entrar, ou envie um e-mail para receber um convite
- Interessado em entrar no time: contate [t4wefan@qq.com](mailto:t4wefan@qq.com)

<a id="links"></a>

## Links

Projetos do ecossistema DeepSeek Harness e ferramentas de desenvolvedor:

| Projeto | Descrição | Link |
| --- | --- | --- |
| dshfind | Comunidade de aprendizado e compartilhamento para DeepSeek Harness (DSH). | [GitHub](https://github.com/hikariming/dshfind) · [Site](https://dshfind.com) |
| DSH 1024Store | Catálogo de plugins da comunidade para o DSH, com mercado de código aberto, pipeline de catálogo e API de consulta pública. | [GitHub](https://github.com/imsai-sh/awesome-deepseek-harness-plugins) |
| Awesome DSH Plugin | Lista curada de plugins do DeepSeek Harness. | [GitHub](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) |
| dsh-market | Mercado visual de plugins dentro do DSH com navegação, busca e instalação em um clique. | [GitHub](https://github.com/dsh-market/dsh-market) |
| ModLens | OCR, layout e reconhecimento semântico para DSH e agentes de codificação apenas de texto. | [GitHub](https://github.com/liustack/modlens) |
| DeepSeek Harness orange book | Manual da comunidade sobre práticas verificadas do DeepSeek Harness. | [GitHub](https://github.com/alchaincyf/deepseek-harness-orange-book) |
| dsh-web-ui | Coleção de plugins e skins da interface Web do DeepSeek Harness. | [GitHub](https://github.com/zhu1090093659/dsh-web-ui) |
| dsh-TUI | Interface de terminal interativa em tela cheia para DeepSeek Harness. | [GitHub](https://github.com/ccch1mneyyy/dsh-TUI) |
| dsh-context | Painel de insights de contexto para DSH: dashboard, comando `/context` e navegador. | [GitHub](https://github.com/bowenliang123/dsh-context) |
| Agents-Anywhere | Controle um agente de codificação no seu computador pelo celular. | [GitHub](https://github.com/anywhere-labs/Agents-Anywhere) |
| DSH-better-sidebar | Ambiente de barra lateral do DSH que integra arquivos, terminal, Git e subagentes. | [GitHub](https://github.com/omdsh-dev/DSH-better-sidebar) |
| Awesome DeepSeek Harness | Lista curada de plugins, ferramentas e infraestrutura do DSH. | [GitHub](https://github.com/0xsline/awesome-deepseek-harness) |

<a id="license"></a>

## Licença

Copyright © 2026 **Nonead Corporation**. Distribuído sob a [Licença MIT](LICENSE).

> “DeepSeek Harness” é uma marca registrada da DeepSeek. O nome é usado apenas para descrever com precisão a compatibilidade, a origem técnica e a relação com o software upstream.

> Este projeto é completamente gratuito e de código aberto. Se alguém vender este software para você de qualquer forma, recuse a transação.

> O Nonead DSH Desktop é um projeto independente da comunidade e não possui vínculo de subordinação, parceria, licenciamento ou endosso com a DeepSeek.
