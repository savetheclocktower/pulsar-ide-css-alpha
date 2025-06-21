const Path = require('path');
const which = require('which');
const { AutoLanguageClient } = require('@savetheclocktower/atom-languageclient');

const CODE_ACTION_KINDS = [
  '_css.applyCodeAction'
];

const ROOT = Path.normalize(Path.join(__dirname, '..'));

class NodePathError extends Error {
  name = 'NodePathError';
}

class CSSLanguageClient extends AutoLanguageClient {
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
    let scopes = ['source.css', 'source.css.scss', 'source.css.less'];
    // if (additionalScopes) scopes.push(...additionalScopes);
    return scopes;
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

    // TODO: Configuration?
    // Send some base config settings. We do our best to get the user's config
    // for various kinds of files.
    server.connection.didChangeConfiguration({
      settings: {
        css: this.buildConfigurationForLanguage('css'),
        less: this.buildConfigurationForLanguage('less'),
        scss: this.buildConfigurationForLanguage('scss')
      }
    });
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

  getScopedSettingsForKey(key, scopeName) {
    let schema = atom.config.getSchema(key);
    if (!schema) throw new Error(`Unknown config key: ${schema}`);

    let base = atom.config.get(key);
    if (!scopeName) return base;

    let scoped = atom.config.get(key, { scope: [scopeName] });

    if (schema?.type === 'object') {
      return { ...base, ...scoped };
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
    return super.provideAutocomplete(...args);
  }

  // LINTER
  // ======

  getLinterSettings (_editor) {
    return {};
  }

  shouldIgnoreMessage (_diagnostic, _editor, _range) {
    // TODO: Figure out which diagnostics get sent and how to test them.
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
}

module.exports = new CSSLanguageClient();
