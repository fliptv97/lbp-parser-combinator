import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { contextual, choice, str, letters, digits, between, many, sepBy } from "./lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Constants
const TYPES = {
  INT: "int",
  STRING: "string",
  BOOL: "boolean",
};


// Parsers
const whitespaceParser = many(str(" "));
const quoteParser = choice(str("'"), str('"'));

const declarationTypeParser = choice(str("let"), str("const"));
const variableNameParser = many(choice(letters, str("_"))).map((results) => results.join(""));
const typeParser = choice([str(TYPES.INT), str(TYPES.STRING), str(TYPES.BOOL)]);

const parsersByType = {
  [TYPES.INT]: digits.map((result) => Number(result)),
  [TYPES.STRING]: between(quoteParser, quoteParser)(letters),
  [TYPES.BOOL]: choice([str("true"), str("false")]).map((result) => result === "true"),
};

const variableDeclarationParser = contextual(function* () {
  const variable = {};

  variable.declarationType = yield declarationTypeParser;
  
  yield whitespaceParser;
  
  variable.name = yield variableNameParser;
  
  yield str(":");
  yield whitespaceParser;
  
  variable.type = yield typeParser;
  
  yield whitespaceParser;
  yield str("=");
  yield whitespaceParser;
  
  variable.value = yield parsersByType[variable.type];

  return variable;
});


// Main
const file = fs.readFileSync(path.join(__dirname, "./data/declarations.txt"), "utf-8");
const state = sepBy(str("\n"))(variableDeclarationParser).run(file);

console.log(state);
