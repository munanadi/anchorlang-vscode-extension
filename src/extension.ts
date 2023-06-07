import * as vscode from "vscode";
import { calculateSpace } from "./codeActionProvider";
import { CodeCompletionItemProvider } from "./codeCompletionProvider";

export function activate(context: vscode.ExtensionContext) {
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
  return undefined;
}
