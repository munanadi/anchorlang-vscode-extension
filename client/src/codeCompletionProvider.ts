import * as vscode from "vscode";
import {
  CompletionItemKind,
  CompletionItemProvider,
} from "vscode";

export class CodeCompletionItemProvider
  implements CompletionItemProvider
{
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<
    | vscode.CompletionItem[]
    | vscode.CompletionList<vscode.CompletionItem>
  > {
    const prefix = document
      .lineAt(position)
      .text.slice(0, position.character);
    if (prefix.startsWith("#[account(")) {
      // console.log("Yes, inside the account thing");
      // completions.push(new vscode.CompletionItem("mut"));
    }

    const pdaCompletion = new vscode.CompletionItem("pda");
    pdaCompletion.insertText = new vscode.SnippetString(
      "#[account(\n\tinit,\n\tseeds = [${1}],\n\tbump,\n\tpayer = ${2:owner},\n\tspace = 8 + size_of::<${3:SomeState}>()\n\t)]\npub ${4:pda_account}: AccountLoader<'info, ${3}>,"
    );
    pdaCompletion.documentation = new vscode.MarkdownString(
      "Inserts a PDA"
    );

    const systemPrgmCompletion = new vscode.CompletionItem(
      "sysprgm"
    );
    systemPrgmCompletion.insertText =
      new vscode.SnippetString(
        "pub system_program: Program<'info, System>,"
      );
    systemPrgmCompletion.documentation =
      new vscode.MarkdownString(
        "Place holder for adding the system program as an account"
      );

    // return all completion items as array
    return [pdaCompletion, systemPrgmCompletion];
  }
}
