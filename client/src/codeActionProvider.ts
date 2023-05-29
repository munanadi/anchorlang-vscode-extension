import * as vscode from "vscode";
import { Position } from "vscode";

export class AccountCodeActionProvider
  implements vscode.CodeActionProvider
{
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const selectedText = document.getText(range);

    // Regular expression pattern to match the struct with parse a struct
    const regex =
      /\s*([\s\S]*?)pub\s*struct\s*(\w+)\s*\{([\s\S]*?)\}/;

    // Check if the selected text matches the struct pattern
    const wholeStruct = regex.exec(selectedText);

    if (!wholeStruct) {
      console.log("No struct with #[account]");
      return [];
    }

    // Gets all strct decorators
    const decorators = new Array(wholeStruct[1])
      .toString()
      .trim()
      .split("\n");

    const isAccount = decorators.some((decorator) => {
      return decorator === "#[account]";
    });

    if (!isAccount) {
      // Does not have #[account] as a decorator.
      // console.log("Does not have #[account] decorator");
      return [];
    }

    const structName = wholeStruct[2].toString().trim();
    const fieldsWithTypes: string[] = [];

    new Array(wholeStruct[3])
      .toString()
      .trim()
      .split(",")
      .forEach((field) => {
        field = field.trim();
        field !== "" && fieldsWithTypes.push(field);
      });

    const fields: { name: string; type: string }[] = [];

    for (const fieldType of fieldsWithTypes) {
      const [filedWithVis, type] = fieldType.split(":"); // pub ident_name: type
      const fieldName = filedWithVis.split(" ")[1].trim(); // pub ident_name
      fields.push({ name: fieldName, type: type.trim() });
    }

    // Generate the impl block code
    const implCode = generateImplCode(fields, structName);

    // Create a new code action with the generated code
    const codeAction = new vscode.CodeAction(
      "Calculate Space",
      vscode.CodeActionKind.Refactor
    );
    codeAction.edit = new vscode.WorkspaceEdit();
    codeAction.edit.insert(
      document.uri,
      new Position(range.end.line + 1, 0),
      implCode
    );

    return [codeAction];
  }
}

function generateImplCode(
  fields: { name: string; type: string }[],
  structName: string
): string {
  const codeLines = [
    `impl ${structName} {`,
    `    pub const SIZE: usize = 8 + // Anchor discriminator`,
  ];

  const fieldCount = fields.length;

  fields.forEach((field, index) => {
    const isLast = fieldCount === index + 1;

    codeLines.push(
      `${getMemberSizeCodeLine(field, isLast)}`
    );
  });

  codeLines.push(`}`);

  return codeLines.join("\n");
}

function getMemberSizeCodeLine(
  field: {
    name: string;
    type: string;
  },
  isLast: boolean
): string {
  // Modify this function to handle different field types appropriately
  const type = field.type.toLowerCase();
  const name = field.name;

  // Construct the "filed - type comment"
  let returnString = `${
    isLast ? ";" : "+"
  }// ${name} - ${type}`;

  let spaceString = ``;

  switch (type) {
    case "bool":
      spaceString += `1`;
      break;
    case "u8":
    case "i8":
      spaceString += `1`;
      break;
    case "u16":
    case "i16":
      spaceString += `2`;
      break;
    case "u32":
    case "i32":
      spaceString += `4`;
      break;
    case "u64":
    case "i64":
      spaceString += `8`;
      break;
    case "u128":
    case "i128":
      spaceString += `16`;
      break;
    case "f32":
      spaceString += `4`;
      break;
    case "f64":
      spaceString += `8`;
      break;
    case "pubkey":
      spaceString += `32`;
      break;
    default: {
      // TODO: handle gracefully.
      console.log(`Unknow type! ${type}`);
      spaceString += `0// ${name} - ${type}`;
    }
  }

  return `\t${spaceString} ${returnString}`;
}
