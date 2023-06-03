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
    const fullText = document.getText();

    // Check if the code action was manually invoked
    if (
      context.triggerKind !==
      vscode.CodeActionTriggerKind.Invoke
    ) {
      return []; // Return empty array if not manually invoked
    }

    // Regular expression pattern to match the struct with parse a struct
    const structRegex =
      /\s*([\s\S]*?)pub\s*(struct)\s*(\w+)\s*\{([\s\S]*?)\}/;

    // TODO: Find Enums in the doc
    const enumRegex =
      /\s*pub\s*enum\s*(\w+)\s*\{((?:[^{}]+|{[^{}]*}|(2?))*)\}/g;

    let allEnumsMatch;
    let allEnums = [];
    while (
      (allEnumsMatch = enumRegex.exec(fullText)) !== null
    ) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (allEnumsMatch.index === enumRegex.lastIndex) {
        enumRegex.lastIndex++;
      }

      // The result can be accessed through the `allEnumsMatch`-variable.
      allEnums.push(
        allEnumsMatch.map((match, groupIndex) => {
          if (groupIndex === 1 || groupIndex === 2) {
            return match;
          }
        })
      );
    }

    const EnumObjs: any = {};

    allEnums.forEach((e) => {
      let id = e[1].trim();
      EnumObjs[id] = e[2].trim();
    });

    // Check if the selected text matches the struct pattern
    const wholeStruct = structRegex.exec(selectedText);

    if (!wholeStruct) {
      // console.log("No struct with #[account]");
      return [];
    }

    // Gets all strct decorators
    const decorators = new Array(wholeStruct[1])
      .toString()
      .trim()
      .split("\n");

    // The space allocation is for only accounts without `zero-copy``
    // https://www.anchor-lang.com/docs/space#:~:text=This%20only%20applies%20to%20accounts%20that%20don%27t%20use%20zero%2Dcopy
    const isAccount = decorators.some((decorator) => {
      return decorator === "#[account]";
    });

    if (!isAccount) {
      // Does not have #[account] as a decorator.
      // console.log("Does not have #[account] decorator");
      return [];
    }

    const structName = wholeStruct[3].toString().trim();
    const fieldsWithTypes: string[] = [];

    new Array(wholeStruct[4])
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
    const implCode = generateImplCode(
      fields,
      structName,
      EnumObjs
    );

    // Create a new code action with the generated code
    const codeAction = new vscode.CodeAction(
      "Calculate Space",
      vscode.CodeActionKind.Refactor
    );

    codeAction.edit = new vscode.WorkspaceEdit();
    codeAction.edit.insert(
      document.uri,
      new Position(range.end.line + 2, 0),
      implCode
    );

    return [codeAction];
  }
}

function generateImplCode(
  fields: { name: string; type: string }[],
  structName: string,
  EnumObjs: any
): string {
  const codeLines = [
    `impl ${structName} {`,
    `    pub const SIZE: usize = 8 + // Anchor discriminator`,
  ];

  const fieldCount = fields.length;

  fields.forEach((field, index) => {
    const isLast = fieldCount === index + 1;

    codeLines.push(
      `${getMemberSizeCodeLine(field, isLast, EnumObjs)}`
    );
  });

  codeLines.push(`}\n\n`);

  return codeLines.join("\n");
}

// Modify this function to handle different field types appropriately
function getMemberSizeCodeLine(
  field: {
    name: string;
    type: string;
  },
  isLast: boolean,
  EnumObjs: any
): string {
  const type = field.type;
  const name = field.name;

  // For Nested types
  const onlySimpleType = simpleTypes.includes(
    type.toLowerCase()
  );

  let spaceAllocated: string;

  if (onlySimpleType) {
    spaceAllocated = spaceForType(type).toString();
  } else {
    // Matches either the Vec<T> or Option<T>
    const vecOrOptionRegex = /(\w*)<(\w*)>/;
    const [isVecOrOption, wrapper, innerType] = type.match(
      vecOrOptionRegex
    )
      ? type.match(vecOrOptionRegex)
      : [undefined, undefined, undefined];
    // Check if array type
    const isArrayType = type.split(";").length !== 1;
    // Has to be either a String or Enum
    const isString = type.trim() === "String";

    if (isVecOrOption) {
      // vector
      if (wrapper.toLowerCase() === "vec") {
        spaceAllocated = `4 + ( ${spaceForType(
          innerType
        )} * MAX_${name.toUpperCase()} )`;
      } else {
        // option
        spaceAllocated = `1 + ${spaceForType(innerType)}`;
      }
    } else if (isArrayType) {
      let [genericType, amount] = isArrayType
        ? type.split(";")
        : [undefined, undefined];

      genericType = genericType.split("[")[1].trim();
      amount = amount.split("]")[0].trim();

      spaceAllocated = `${
        spaceForType(genericType) * parseInt(amount)
      } + // (${spaceForType(genericType)} * ${amount})`;
    } else if (isString) {
      console.log(`${name} is a String`);
      // TODO: Ask for input for max size from user.
      spaceAllocated = `4 // Add input from user here`;
    } else {
      // Has to be Enum. Find it in the document
      // TODO: handle Enums.

      const enumBody = EnumObjs[type];
      const fields = enumBody
        .split("\n")
        .map((ele) => ele.trim())
        .filter((ele) => ele);

      const structRegex = /\s*(\w+)\s*\{([\s\S]*?)\}/;

      let largestField;

      fields.forEach((field) => {
        const wholeStruct = structRegex.exec(field);

        if (wholeStruct) {
          const structBody = wholeStruct[2].trim();

          largestField = structBody.split(",").reduce(
            (acc, val) => {
              const [currName, currType] = val
                .split(":")
                .map((e) => e.trim());

              const [prevName, prevType] = acc;

              if (
                spaceForType(currType) >
                spaceForType(prevType)
              ) {
                return [currName, currType];
              }
              return [prevName, prevType];
            },
            ["null", "null"]
          );
        }
      });

      spaceAllocated = !largestField
        ? `1 //`
        : `1 + ${spaceForType(largestField[1])} +// ${
            largestField[0]
          } is the largest field`;

      console.log(spaceAllocated);
    }
  }

  // Construct the "filed - type comment"
  let returnString = `${
    isLast ? ";" : "+"
  } // ${name} - ${type}`;

  return `\t${spaceAllocated} ${returnString}`;
}

// returns space for the normal types
function spaceForType(type: string): number {
  type = type.toLowerCase();

  switch (type) {
    case "bool":
      return 1;
    case "u8":
    case "i8":
      return 1;
    case "u16":
    case "i16":
      return 2;
    case "u32":
    case "i32":
      return 4;
    case "u64":
    case "i64":
      return 8;
    case "u128":
    case "i128":
      return 16;
    case "f32":
      return 4;
    case "f64":
      return 8;
    case "pubkey":
      return 32;
    default: {
      console.log(`${type} not known`);
      return 0;
    }
  }
}

const simpleTypes = [
  "bool",
  "u8",
  "i8",
  "u16",
  "i16",
  "u32",
  "i32",
  "u64",
  "i64",
  "u128",
  "i128",
  "f32",
  "f64",
  "pubkey",
];
