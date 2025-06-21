# pulsar-ide-css-alpha package

Visual Studio Code’s CSS language server in [Pulsar](https://pulsar-edit.dev). Uses [vscode-langservers-extracted](https://www.npmjs.com/package/vscode-langservers-extracted).

Supports CSS, SCSS, and LESS.

Features:

* Completion (via the builtin `autocomplete-plus`)
* Symbol listing and navigation (via the builtin `symbols-view`)
* Diagnostics (theoretically; haven’t seen any yet, but if they’re present they’d be consumed via `linter` and `linter-ui-default`)
* Highlighting references (put your cursor on a token and see all other usages of that token; used via `pulsar-find-references`)
* Other stuff I haven’t yet experimented with

## Configuration

A recent version of Node should be used. The version of Node inherited from your shell environment will usually suffice; if Pulsar fails to find it, you may specify it in the “Path To Node Binary” configuration field.
