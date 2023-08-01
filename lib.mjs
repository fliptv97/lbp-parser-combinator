// Constants
const digitsRegex = /^[0-9]+/;
const lettersRegex = /^[a-zA-Z]+/;


// Helpers
export const updateParserState = (state, index, result) => ({
  ...state,
  index,
  result,
});

export const updateParserResult = (state, result) => ({
  ...state,
  result,
});

export const updateParserError = (state, error) => ({
  ...state,
  isError: true,
  error,
});

// Main
export class Parser {
  constructor(parserStateTransformerFn) {
    this.parserStateTransformerFn = parserStateTransformerFn;
  }

  run(input) {
    const initialState = {
      input,
      index: 0,
      result: null,
      isError: false,
      error: null,
    };

    return this.parserStateTransformerFn(initialState);
  }

  map(fn) {
    return new Parser((parserState) => {
      const nextState = this.parserStateTransformerFn(parserState);

      if (nextState.isError) return nextState;

      return updateParserResult(nextState, fn(nextState.result));
    });
  }

  errorMap(fn) {
    return new Parser((parserState) => {
      const nextState = this.parserStateTransformerFn(parserState);

      if (!nextState.isError) return nextState;

      return updateParserError(nextState, fn(nextState.error, nextState.index));
    });
  }

  chain(fn) {
    return new Parser((parserState) => {
      const nextState = this.parserStateTransformerFn(parserState);

      if (nextState.isError) return nextState;

      const nextParser = fn(nextState.result);

      return nextParser.parserStateTransformerFn(nextState);
    });
  }
}

export const choice = (...parsers) =>
  new Parser((parserState) => {
    if (parserState.isError) return parserState;

    const _parsers = Array.isArray(parsers[0]) ? parsers[0] : parsers;

    for (let parser of _parsers) {
      const nextState = parser.parserStateTransformerFn(parserState);

      if (!nextState.isError) return nextState;
    }

    return updateParserError(parserState, `choice: Unable to match with any parser at index ${parserState.index}`);
  });

export const many = (parser) =>
  new Parser((parserState) => {
    if (parserState.isError) return parserState;

    const result = [];

    let nextState = parserState;
    let isDone = false;

    while (!isDone) {
      const tempState = parser.parserStateTransformerFn(nextState);

      if (!tempState.isError) {
        result.push(tempState.result);

        nextState = tempState;
      }

      isDone = tempState.isError;
    }

    return updateParserResult(nextState, result);
  });

export const many1 = (parser) =>
  new Parser((parserState) => {
    if (parserState.isError) return parserState;

    const result = [];

    let nextState = parserState;
    let isDone = false;

    while (!isDone) {
      const tempState = parser.parserStateTransformerFn(nextState);

      if (!nextState.isError) {
        result.push(tempState.result);

        nextState = tempState;
      }

      isDone = nextState.isError;
    }

    if (result.length === 0) {
      return updateParserError(
        parserState,
        `many1: Unable to match any input using parser at index ${parserState.index}`
      );
    }

    return updateParserResult(nextState, result);
  });

export const sepBy = (separatorParser) => (valueParser) =>
  new Parser((parserState) => {
    const result = [];

    let nextState = parserState;

    while (true) {
      const valueParserState = valueParser.parserStateTransformerFn(nextState);

      if (valueParserState.isError) break;

      result.push(valueParserState.result);

      nextState = valueParserState;

      const separatorParserState = separatorParser.parserStateTransformerFn(valueParserState);

      if (separatorParserState.isError) break;

      nextState = separatorParserState;
    }

    return updateParserResult(nextState, result);
  });

export const sepBy1 = (separatorParser) => (valueParser) =>
  new Parser((parserState) => {
    const result = [];

    let nextState = parserState;

    while (true) {
      const valueParserState = valueParser.parserStateTransformerFn(nextState);

      if (valueParserState.isError) break;

      result.push(valueParserState.result);

      nextState = valueParserState;

      const separatorParserState = separatorParser.parserStateTransformerFn(valueParserState);

      if (separatorParserState.isError) break;

      nextState = separatorParserState;
    }

    if (result.length === 0) {
      return updateParserError(parserState, `sepBy1: Unable to capture any results at index ${parserState.index}`);
    }

    return updateParserResult(nextState, result);
  });

export const sequenceOf = (...parsers) =>
  new Parser((parserState) => {
    if (parserState.isError) {
      return parserState;
    }

    const result = [];

    let nextState = parserState;

    const _parsers = Array.isArray(parsers[0]) ? parsers[0] : parsers;

    for (let parser of _parsers) {
      nextState = parser.parserStateTransformerFn(nextState);

      result.push(nextState.result);
    }

    if (nextState.isError) {
      return nextState;
    }

    return updateParserResult(nextState, result);
  });

export const str = (s) =>
  new Parser((parserState) => {
    const { input, index, isError } = parserState;

    if (isError) return parserState;

    const inputSlice = input.slice(index);

    if (inputSlice.length <= 0) {
      return updateParserError(parserState, `str: Unexpected end of input`);
    }

    if (input.slice(index).startsWith(s)) {
      return updateParserState(parserState, index + s.length, s);
    }

    return updateParserError(parserState, `str: Tried to match "${s}", but got "${input.slice(index, 10)}"`);
  });

export const letters = new Parser((parserState) => {
  const { input, index, isError } = parserState;

  if (isError) return parserState;

  const inputSlice = input.slice(index);

  if (inputSlice.length <= 0) {
    return updateParserError(parserState, `letters: Unexpected end of input`);
  }

  const match = inputSlice.match(lettersRegex);

  if (match) {
    return updateParserState(parserState, index + match[0].length, match[0]);
  }

  return updateParserError(parserState, `letters: Couldn't match letters at index ${index}`);
});


export const digits = new Parser((parserState) => {
  const { input, index, isError } = parserState;

  if (isError) return parserState;

  const inputSlice = input.slice(index);

  if (inputSlice.length <= 0) {
    return updateParserError(parserState, `digits: Unexpected end of input`);
  }

  const match = inputSlice.match(digitsRegex);

  if (match) {
    return updateParserState(parserState, index + match[0].length, match[0]);
  }

  return updateParserError(parserState, `digits: Couldn't match letters at index ${index}`);
});

export const lazy = (parserThunk) =>
  new Parser((parserState) => {
    const parser = parserThunk();

    return parser.parserStateTransformerFn(parserState);
  });

export const between = (leftBracketParser, rightBracketParser) => (valueParser) =>
  sequenceOf(leftBracketParser, valueParser, rightBracketParser).map((results) => results[1]);

export const fail = (error) => new Parser((parserState) => updateParserError(parserState, error));

export const succeed = (results) => new Parser((parserState) => updateParserResult(parserState, results));

// TODO: WTF is this?
export const contextual = (generatorFn) =>
  succeed(null).chain(() => {
    const iterator = generatorFn();

    const runStep = (nextValue) => {
      const iteratorResult = iterator.next(nextValue);

      if (iteratorResult.done) {
        return succeed(iteratorResult.value);
      }

      const nextParser = iteratorResult.value;

      if (!(nextParser instanceof Parser)) {
        throw new Error("contextual: yielded values must always be parsers!");
      }

      return nextParser.chain(runStep);
    };

    return runStep();
  });


// My own experiments
export const expect = (expectedValue, errorMessage) => (result) =>
  new Parser((parserState) => {
    if (parserState.isError) return parserState;
    if (result === expectedValue) return parserState;

    return updateParserError(parserState, errorMessage?.(parserState.result, parserState.index - 1) ?? "Invalid value");
  });
