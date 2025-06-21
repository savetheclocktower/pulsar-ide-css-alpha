const Path = require('path');
const { CompositeDisposable } = require('atom');
const which = require('which');
const safeGet = require('just-safe-get');
const safeSet = require('just-safe-set');
const extend = require('just-extend');
const { AutoLanguageClient } = require('@savetheclocktower/atom-languageclient');

const CODE_ACTION_KINDS = [
  '_css.applyCodeAction'
];

const ROOT = Path.normalize(Path.join(__dirname, '..'));

class NodePathError extends Error {
  name = 'NodePathError';
}

const CONFIG_TRANSLATIONS = {
  'references.enable': 'hover.references',
};

const DEFAULT_SCOPES = ['source.css', 'source.css.scss', 'source.css.less'];

// Migrates all settings from the old package name to the new package name.
function migrateConfig(oldPackageName, newPackageName) {
  let oldSettings = atom.config.get(
    `${oldPackageName}`,
    { sources: [atom.config.mainSource] }
  ) ?? {};

  let newSettings = atom.config.get(
    `${newPackageName}`,
    { sources: [atom.config.mainSource] }
  ) ?? {};

  // Copy all settings over to the new location, merging with existing config
  // if necessary.
  atom.config.set(
    `${newPackageName}`,
    extend(true, {}, oldSettings, newSettings)
  );
  // Remove all configuration at the old location.
  atom.config.unset(`${oldPackageName}`);
}

// Check if we need to migrate config settings from an old package name.
function checkConfigMigration(oldPackageName, newPackageName) {
  if (oldPackageName === newPackageName) {
    // Package hasn’t been renamed yet! Be patient.
    return;
  }
  let oldSettings = atom.config.get(
    `${oldPackageName}`,
    { sources: [atom.config.mainSource] }
  );
  let newSettings = atom.config.get(
    `${newPackageName}`,
    { sources: [atom.config.mainSource] }
  );

  // Don’t migrate if there’s nothing to migrate — or if the user has already
  // set some config values at the new location.
  if (!oldSettings || newSettings) return;

  migrateConfig(oldPackageName, newPackageName);

  atom.notifications.addInfo(
    `${newPackageName}: Migrated configuration`,
    {
      description: `This package’s name has changed from \`${oldPackageName}\` to \`${newPackageName}\`. Your existing configuration values have been migrated to the new setting path.`,
      dismissable: true
    }
  );
}


class CSSLanguageClient extends AutoLanguageClient {
  constructor (...args) {
    super(...args);

    this.enableLinting = true;
    this.enableReferences = true;
    this.enableAutocomplete = true;

    this.disposable = new CompositeDisposable();

    this.disposable.add(
      atom.config.observe(`${this.getPackageName()}.serverSettings.lint.enable`, (value) => {
        this.enableLinting = value;
      }),
      atom.config.observe(`${this.getPackageName()}.serverSettings.references.enable`, (value) => {
        this.enableReferences = value;
      }),
      atom.config.observe(`${this.getPackageName()}.serverSettings.completion.enable`, (value) => {
        this.enableAutocomplete = value;
      })
    );
  }

  activate (...args) {
    checkConfigMigration('pulsar-ide-css-alpha', this.getPackageName());
    super.activate(...args);
  }

  deactivate (...args) {
    this.disposable.dispose();
    super.deactivate(...args);
  }

  getLanguageName () { return 'CSS/SCSS/LESS'; }
  getServerName () { return 'CSS Language Server'; }

  getPackageName () {
    return Path.basename(ROOT) ?? 'pulsar-ide-css';
  }

  getPathToServer() {
    return Path.join(ROOT, 'node_modules', '.bin', 'vscode-css-language-server');
  }


  // Convert the configured Node to an absolute path.
  getPathToNode () {
    let path = atom.config.get(`${this.getPackageName()}.nodeBin`) ?? 'node';
    if (!path.includes(Path.sep)) {
      // Must be on the `PATH`. Let's check.
      try {
        path = which.sync(path);
        return path;
      } catch (err) {
        throw new NodePathError(`Path not recognized`);
      }
    }
    if (!fs.existsSync(path)) {
      throw new NodePathError(`Path not recognized`);
    }
    return path;
  }

  getGrammarScopes () {
    // TODO: Configuration of additional scopes?
    // let packageName = this.getPackageName();
    // let additionalScopes = atom.config.get(
    //   `${packageName}.advanced.additionalScopes`
    // );
    return DEFAULT_SCOPES;
  }

  getKindsForCodeActionRequest (_editor, _range, diagnostics) {
    // If there are any diagnostic messages associated with this position in
    // the editor, don't add any kinds. The only things that should appear in
    // the menu are actions associated with fixing that diagnostic.
    if (diagnostics.length > 0) return [];

    // Otherwise the user has asked for code actions in some other section of
    // the editor that has no diagnostic message. We should present them with
    // all the possible actions they can do on this file.
    return CODE_ACTION_KINDS;
  }

	startServerProcess() {
    // The process is a binary file. We shouldn't assume that Node can run this
    // directly; it's meant to be invoked in a shell without being prefixed by
    // `node`. The latter only works on Unix-y environments in which the
    // JavaScript CLI script can be symlinked straight into `.bin`.
    //
    // In order to run with a specific version of Node, we should be able to
    // unshift the directory of our desired Node executable onto the front of
    // the `PATH`.
    try {
      let nodeBin = this.getPathToNode();
      let env = {
        ...process.env,
        PATH: `${Path.dirname(nodeBin)}${process.env.PATH ? `:${process.env.PATH}` : ''}`
      };
  		let bin = this.getPathToServer();
      this.logger.debug(`Starting bin at path: ${bin} with node: ${nodeBin}`);
      return super.spawn(bin, ["--stdio"], {
        cwd: atom.project.getPaths[0] || __dirname,
        env
  		});
    } catch (err) {
      this.showStartupError(err);
    }
	}

  showStartupError (err) {
    this.errorNotification = atom.notifications.addError(
      `${this.getPackageName()}: ${this.getServerName()} language server cannot start`,
      {
        description: `Make sure the path to your Node binary is correct and is of version 18 or greater.\n\nIf \`node\` is in your \`PATH\` and Pulsar is not recognizing it, you may set the path to your Node binary in this package’s settings. Consult the README on the settings page for more information.`,
        detail: err.message,
        buttons: [
          {
            text: 'Open Settings',
            onDidClick: () => {
              atom.workspace.open(`atom://config/packages/${this.getPackageName()}`);
            }
          }
        ],
        dismissable: true
      }
    );
  }

  getConnectionType() {
    return 'stdio';
  }

  getInitializeParams (...args) {
    let result = super.getInitializeParams(...args);
    result.initializationOptions = {
      provideFormatter: true
    };
    return result;
  }

  postInitialization (server) {
    // Ordinarily we'll just assume the server started successfully and that it
    // isn't worth informing the user about. But if the server was previously
    // in an error state…
    if (this.errorNotification) {
      // …dismiss that old notification (if it's still present)…
      this.errorNotification.dismiss();
      // …and tell the user that it's been fixed.
      atom.notifications.addSuccess(
        `${this.getPackageName()}: ${this.getServerName()} started`
      );
      this.errorNotification = null;
    }

    this._server = server;
  }

  getRootConfigurationKey () {
    return `${this.getPackageName()}.serverSettings`;
  }

  mapConfigurationObject (_config) {
    let result = {};

    for (let lang of ['css', 'scss', 'less']) {
      // This retrieves the entire config object, plus any language-specific
      // overrides, no matter how deep. We don't even need to consult the
      // argument we're given.
      let base = this.getScopedSettingsForLanguage(
        `${this.getPackageName()}.serverSettings`,
        lang
      );

      base.hover ??= {};

      for (let [origin, destination] of Object.entries(CONFIG_TRANSLATIONS)) {
        let value = safeGet(base, origin);
        safeSet(base, destination, value);
        safeSet(base, origin, null);
      }

      result[lang] = base;
    }

    // console.log('Mapped configuration:', result);
    return result;
  }

  buildConfigurationForLanguage(language) {
    let scopeName = `source.css`;
    if (language !== 'css') {
      scopeName += `.${language}`;
    }
    let tabSize = this.getScopedSettingsForKey(`editor.tabLength`, scopeName);
    let insertSpaces = this.getScopedSettingsForKey(`editor.softTabs`, scopeName);
    let wrapLineLength = this.getScopedSettingsForKey(`editor.preferredLineLength`, scopeName);

    return {
      format: {
        tabSize,
        insertSpaces,
        wrapLineLength
      }
    }
  }

  getSetting (key, ...args) {
    return atom.config.get(`${this.getPackageName()}.${key}`, ...args)
  }

  getScopeNameForLanguage (language) {
    let scopeName = `source.css`;
    if (language === 'css') return scopeName;
    return `${scopeName}.${language}`;
  }

  getScopedSettingsForLanguage(key, language) {
    let scopeName = this.getScopeNameForLanguage(language);
    return this.getScopedSettingsForKey(key, scopeName);
  }

  getScopedSettingsForKey(key, scopeName) {
    let schema = atom.config.getSchema(key);
    if (!schema) throw new Error(`Unknown config key: ${schema}`);

    let base = atom.config.get(key);
    if (!scopeName) return base;

    let scoped = atom.config.get(key, { scope: [scopeName] });

    if (schema?.type === 'object') {
      // For objects, do a deep-merge.
      return extend(true, {}, base, scoped);
    } else {
      return scoped ?? base;
    }
  }

  getEditorSettingsForKey (key, editor) {
    let schema = atom.config.getSchema(key);
    if (!schema) throw new Error(`Unknown config key: ${schema}`);

    let base = atom.config.get(key);
    if (!editor) return base;

    let grammar = editor.getGrammar();
    let scoped = atom.config.get(key, { scope: [grammar.scopeName] });

    if (schema?.type === 'object') {
      return { ...base, ...scoped };
    } else {
      return scoped ?? base;
    }
  }

  // AUTOCOMPLETE
  // ============

  provideAutocomplete (...args) {
    // Allow the user to configure whether autocomplete is enabled. Unlike most
    // other such settings, this one requires a restart/reload to apply, and
    // isn't scope-specific.
    // TODO: Make this configurable.
    let result = super.provideAutocomplete(...args);
    let original = result.getSuggestions;
    result.getSuggestions = (...args) => {
      if (!this.enableAutocomplete) return Promise.resolve([]);
      return original(...args);
    };
    return result;
  }

  // LINTER
  // ======

  getLinterSettings (_editor) {
    return {};
  }

  shouldIgnoreMessage (_diagnostic, _editor, _range) {
    // TODO: The `lint.enable` server setting does not seem to prevent
    // diagnostics from being sent (not sure why!), so we have to keep track of
    // this on the client.
    if (!this.enableLinting) return true;
    return false;
  }

  // SYMBOLS
  // =======

  getSymbolSettings (_editor) {
    return {}
  }

  shouldIgnoreSymbol (_symbol, _editor) {
    return false;
  }

  // INTENTIONS
  // ==========

  // This is annoying because it should be almost entirely a package-specific
  // concern. But `atom-languageclient` must be aware of this because there's
  // no concept of a “code” or “message type” in the `linter` service contract.
  // So we can't pull this off just by inspecting the linter messages; we have
  // to look at the original `Diagnostic` objects from the language server.
  getIntentionsForLinterMessage (_message, _editor) {
    // TODO: Once we find out if this server ever sends diagnostics, figure out
    // if any of them have associated code actions.
    return []
  }

  // REFERENCES
  // ==========

  getReferences (...args) {
    // TODO: The `hover.references` server setting does not seem to prevent
    // the server from responding to reference requests, so we have to handle
    // this on the client.
    if (!this.enableReferences) return Promise.resolve(null);
    return super.getReferences(...args);
  }
}

module.exports = new CSSLanguageClient();
