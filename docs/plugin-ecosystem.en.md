# DSH Plugin Ecosystem Manifesto

[中文](plugin-ecosystem.md) | English

DSH Desktop does not want to be only a good desktop shell. It wants to prove one thing: **when the host explains how composition works, the ecosystem grows its own order.** This document is a proposal, not a specification; the specification lives in `dsh-community-fabric`, and it is still a Draft.

## Our vision

A healthy plugin ecosystem has to satisfy three conditions at once, and it degrades if any one is missing:

- **Open**: anyone can write a plugin, publish it and have it installed without an approval gate.
- **Composable**: two plugins that have never heard of each other can be installed together and each keeps working, without knowing the other exists.
- **Sustainable**: a host upgrade does not wipe out plugins in batches, and plugin authors do not have to chase every internal change in the host.

None of this happens by itself. Someone has to draw the boundary first, and then be the first user to obey it.

## Three principles we advocate

**Composition first.** A plugin declares what it needs and the host satisfies it; the plugin does not go looking, editing or bypassing. When it needs platform capability it declares that through injection and patches, instead of reading someone else's config file.

**Declare clearly.** Only what a machine can read is a declaration. `dsh.bundle.patch`, `dsh.client`, `inject`, manifest fields — those are the contract; the explanation in a README is documentation, not a contract. You need both, but one cannot stand in for the other.

**Compatibility first.** The same code must also run in plain DSH without the desktop. If it cannot, it should not be a plugin; it should be a standalone application.

## The desktop shell is the first example

We are not writing a specification and then looking for users; we are doing the reverse: **finish the desktop shell under these principles, then hand it out as the example**.

Concretely:

- Every shell capability arrives through Cordis services and profile patches; not one place needs an upstream change.
- Only two Host services are exposed to plugins, and every other internal is explicitly marked as undependable.
- Compatibility with both Desktop and plain DSH is a hard requirement, not a suggestion.
- Patch mistakes have three different failure modes, and we documented all three — including the one with **no warning at all**.

A host that does not follow the composition principles itself has no standing to ask others to.

## A living document, built together

This document is alive. If a principle conflicts with the code, the document changes; the code does not bend to the document. If you find "the docs say it is supported and it is not", that is a bug — please open an issue.

Likewise, `docs/architecture.md` and `docs/plugin-development.md` describe the **current implementation**, while `dsh-community-fabric` describes the **things intended to become standards**. Reading the two as one is the most common misunderstanding in this area.

## The plugin market: make conventions the advantageous choice

A market is not the judge of an ecosystem; it is the ecosystem's **cost structure**. `dshmarket` is pinned at `1.66.45` (the desktop patch is rebuilt against that version) and ships with Desktop as an ordinary DSH plugin — it declares `dsh.bundle.patch` and `dsh.client` itself, sits next to the built-in capabilities on the official Plugins page, and leaves install, enable, disable and uninstall to the official plugin manager.

`dsh-community-market` (`0.1.0-dev.0`) is the community market's skeleton: four bilingual documents (catalog adapter guide, catalog provider contract, install and uninstall, market shell), JSON Schemas, examples, and two behaviours that already work — install by name and non-image media preview. It is not finished, but its boundary is written down.

The value of a convention is that **those who follow it get a lower distribution cost**. A market entry that follows the schema can be indexed, previewed and installed with one click; a plugin that does not is not "banned", it simply does not get any of that.

## From a proposal to a testable contract

A proposal that cannot be tested eventually decays into a slogan. The next step is turning the principles into a contract:

- `dsh-community-fabric` already holds four Draft RFCs: manifest with capabilities and events (0001), runtime presentation and invocation transport (0002), service providers and composition (0003), provenance validation and diagnostics (0004). All are bilingual, and all are still Drafts — **not published standards**.
- Capabilities are for compatibility decisions, user confirmation and auditing. **They are not a security sandbox**: declaring "I only read files" does not make the runtime grant read-only access.
- Being listed in a catalog is not a security review. A plugin appearing in the market only means it matches the entry format.

Write plugins against what exists today (this document and `plugin-development.md`); take the further shapes to the RFCs — do not implement production code against a Draft, and do not cite one as settled fact.

## How to participate

- **Write a plugin**: start from [plugin development](plugin-development.en.md) and build the version that runs in plain DSH first.
- **Propose an RFC**: the RFC directory in `dsh-community-fabric` is open to everyone, and objections are worth more than agreement.
- **Write documentation**: if documentation and code disagree, fix the documentation or open an issue — both count as contributions.
- **Use it**: real use is the only valid acceptance test. A plugin that will not install or an error message nobody can act on is something the ecosystem has to fix.

## Related documents

- [Architecture](architecture.en.md)
- [Plugin development](plugin-development.en.md)
- [Community market](../dsh-community-market/README.md)
- [Community fabric (Draft)](../dsh-community-fabric/README.md)
- [RFC 0001: manifest, capabilities and events](../dsh-community-fabric/docs/rfcs/0001-plugin-manifest-capabilities-events.md)
