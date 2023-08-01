import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Parser, updateParserError, updateParserState, sequenceOf, succeed, expect } from "./lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const Bit = new Parser((parserState) => {
  if (parserState.isError) return parserState;

  const byteOffset = Math.floor(parserState.index / 8);

  if (byteOffset >= parserState.input.byteLength) {
    return updateParserError(parserState, `Bit: Unexpected end of input`);
  }

  const byte = parserState.input.getUint8(byteOffset);
  const bitOffset = 7 - (parserState.index % 8);
  const bit = (byte >> bitOffset) & 1;

  return updateParserState(parserState, parserState.index + 1, bit);
});

const Zero = Bit.chain(expect(0, (value, index) => `Zero: Expected "0", but got ${value} at index ${index}`));
const One = Bit.chain(expect(1, (value, index) => `One: Expected "1", but got ${value} at index ${index}`));

const Uint = (n) => {
  if (n < 1) {
    throw new Error(`Uint: n must be larger than 0, but got "${n}"`);
  }

  if (n > 32) {
    throw new Error(`Uint: n must be less than 32, but got "${n}"`);
  }

  return sequenceOf(Array.from({ length: n }, () => Bit)).map((bits) =>
    bits.reduce((acc, bit, idx) => acc + Number(BigInt(bit) << BigInt(n - idx - 1)), 0)
  );
};

const Int = (n) => {
  if (n < 1) {
    throw new Error(`Int: n must be larger than 0, but got "${n}"`);
  }

  if (n > 32) {
    throw new Error(`Int: n must be less than 32, but got "${n}"`);
  }

  // i.e. -4 === 1100
  // Most significant bit: 0b1 (2 ^ 3) === 8
  // Without most significnat bit: 0b100 === 4
  // Result: 4 - 8 === -4
  return sequenceOf(Array.from({ length: n }, () => Bit)).map(
    (bits) =>
      bits.slice(1).reduce((acc, bit, idx) => acc + Number(BigInt(bit) << BigInt(n - idx - 2)), 0) -
      Number(BigInt(bits[0]) << BigInt(n - 1))
  );
};

const RawString = (s) => {
  if (s.length < 1) {
    throw new Error(`RawString: s must be at least 1 character`);
  }

  const byteParsers = s
    .split("")
    .map((char) =>
      Uint(8).chain(
        expect(char.charCodeAt(0), (value) => `RawString: Expected "${char}", but got "${String.fromCharCode(value)}"`)
      )
    );

  return sequenceOf(byteParsers);
};

// Main
const tag = (type) => (value) => ({ type, value });

const parser = sequenceOf(
  Uint(4).map(tag("Version")),
  Uint(4).map(tag("IHL")),
  Uint(6).map(tag("DSCP")),
  Uint(2).map(tag("ECN")),
  Uint(16).map(tag("Total Length")),
  Uint(16).map(tag("Identification")),
  Uint(3).map(tag("Flags")),
  Uint(13).map(tag("Fragment Offset")),
  Uint(8).map(tag("TTL")),
  Uint(8).map(tag("Protocol")),
  Uint(16).map(tag("Header Checksum")),
  Uint(32).map(tag("Source IP Address")),
  Uint(32).map(tag("Destination IP Address"))
).chain((results) => {
  const ihl = results[1].value;

  if (ihl > 5) {
    const remainingBytes = Array.from({ length: ihl - 20 }, () => Uint(8));

    return sequenceOf(remainingBytes).chain((remaining) => [...results, tag("Options")(remaining)]);
  }

  return succeed(results);
});

const file = new Uint8Array(fs.readFileSync(path.join(__dirname, "./data/packet.bin"))).buffer;
const dataView = new DataView(file);

const state = parser.run(dataView);

console.log(state);
