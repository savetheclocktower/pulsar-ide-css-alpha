const Path = require('path');
const { AutoLanguageClient } = require('@savetheclocktower/atom-languageclient');

const CODE_ACTION_KINDS = [
  '_css.applyCodeAction'
];

const ROOT = Path.normalize(Path.join(__dirname, '..'));

class CSSLanguageClient extends AutoLanguageClient {
  getLanguageName () { return 'CSS/SCSS/LESS'; }
  getServerName () { return 'CSS Language Server'; }

  getPackageName () {
    return Path.basename(ROOT) ?? 'pulsar-ide-css';
  }

  getPathToServer() {
    return Path.join(ROOT, 'node_modules', '.bin', 'css-languageserver');
  }

  getPathToNode () {
    return atom.config.get(`${this.getPackageName()}.nodeBin`) ?? 'node';
  }

  activate (...args) {
    super.activate(...args);
  }

  destroy (...args) {
    super.destroy(...args);
    this.commandDisposable.dispose();
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

  constructor () {
    super();
  }

	startServerProcess() {
    let nodeBin = this.getPathToNode();
		let bin = this.getPathToServer();
		console.log("Starting bin at path:", bin, "with node:", nodeBin);
		return super.spawn(nodeBin, [bin, "--stdio"], {
			cwd: atom.project.getPaths[0] || __dirname
		});
	}

  getConnectionType() {
    return 'stdio';
  }


  postInitialization (server) {
    this._server = server;

    // TODO: Configuration?
  }

  getScopedSettingsForKey (key, editor) {
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
    // let enabled = atom.config.get(`${this.getPackageName()}.autocomplete.enable`);
    // if (!enabled) return;

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
