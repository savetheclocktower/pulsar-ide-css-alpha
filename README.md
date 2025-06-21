# pulsar-ide-css-alpha package

Visual Studio Code’s CSS language server in [Pulsar](https://pulsar-edit.dev). Uses [vscode-langservers-extracted](https://www.npmjs.com/package/vscode-langservers-extracted).

Supports CSS, [SCSS](https://sass-lang.com/), and [LESS](https://lesscss.org/).

Features:

* Completion (via the builtin `autocomplete-plus`)
* Symbol listing and navigation (via the builtin `symbols-view`)
* Diagnostics (via `linter` and `linter-ui-default`)
* Highlighting references (put your cursor on a token and see all other usages of that token; used via `pulsar-find-references`)
* Ability to do smart project-wide renaming of certain tokens: variable names, animation names, etc. (via `pulsar-refactor`)

## Configuration

A recent version of Node should be used. The version of Node inherited from your shell environment will usually suffice; if Pulsar fails to find it, you may specify it in the “Path To Node Binary” configuration field.

The settings under the “Server Settings” section correspond almost exactly to the settings exposed by the language server. When you change a setting in the UI, it applies to CSS, SCSS, and LESS all at once.

If you want to override a setting for just one language, use a [scope-specific override](https://docs.pulsar-edit.dev/customizing-pulsar/language-specific-configuration-settings/) in your `config.cson`:

```coffeescript
".source.css.less":
  "pulsar-ide-css-alpha":
    serverSettings:
      lint:
        universalSelector: "error"
```
