import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import * as vscode from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { calculateSpace } from "./codeActionProvider";
import { CodeCompletionItemProvider } from "./codeCompletionProvider";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  let debugOptions = {
    execArgv: ["--nolazy", "--inspect=6009"],
  };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      { scheme: "file", language: "rust" },
    ],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents:
        workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "anchorlsp",
    "Anchorlang LSP",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();

  // Register Code Actions
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider("rust", {
      provideCodeActions(document, range, context, token) {
        const codeAction = new vscode.CodeAction(
          "Calculate Space",
          vscode.CodeActionKind.Refactor
        );

        return [codeAction];
      },
      async resolveCodeAction(codeAction, token) {
        // Run the calculateSpace function only when it's called.
        if (codeAction.title === "Calculate Space") {
          await calculateSpace(codeAction);
          return codeAction;
        }

        return codeAction;
      },
    })
  );

  // Completions
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "rust",
      new CodeCompletionItemProvider()
    )
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
