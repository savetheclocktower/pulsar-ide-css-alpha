Currently, we use [vscode-langservers-extracted](https://www.npmjs.com/package/vscode-langservers-extracted) to access this language server. Previously, I spent a lot of effort on extracting it manually; I’ve written down some of those steps in case we ever have to revert to that approach.

In theory, these are the steps we could follow to fully automate this task whenever we want to update this provider:

* Update to the latest `vscode-css-languageservice` dependency
* Checkout `vscode/extensions/css-language-features/server` to `vendor/css-language-features-server`
  * I checked out all of `vscode` and copied the path over myself; if we were to automate this, we’d want the ability to checkout only part of a Git repository. [This StackOverflow answer](https://stackoverflow.com/a/13738951/25720) offers some guidance.
* Run `tsc` within `vendor/css-language-features-server`
* A standalone CSS language server should now be present at `vendor/css-language-features-server/out/cssServerMain.js`
