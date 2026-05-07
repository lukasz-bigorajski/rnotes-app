type CellValue = number | string;

// ── Tokenizer ────────────────────────────────────────────────────────────────

type TokType =
  | "NUMBER"
  | "STRING"
  | "IDENT"
  | "CELL_REF"
  | "RANGE"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "CARET"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "SEMICOLON"
  | "GT"
  | "LT"
  | "GTE"
  | "LTE"
  | "EQ"
  | "NEQ"
  | "EOF";

interface Tok {
  type: TokType;
  value: string;
}

const CELL_REF_RE = /^[A-Za-z]+\d+$/;

function tokenize(input: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }
    // String literal
    if (input[i] === '"') {
      let s = "";
      i++;
      while (i < input.length && input[i] !== '"') {
        s += input[i++];
      }
      i++; // closing "
      tokens.push({ type: "STRING", value: s });
      continue;
    }
    // Number
    if (/\d/.test(input[i]) || (input[i] === "." && /\d/.test(input[i + 1] ?? ""))) {
      let s = "";
      while (i < input.length && /[\d.]/.test(input[i])) s += input[i++];
      tokens.push({ type: "NUMBER", value: s });
      continue;
    }
    // Identifier or cell ref or range
    if (/[A-Za-z]/.test(input[i])) {
      let s = "";
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) s += input[i++];
      // Check for range: CELLREF:CELLREF
      if (input[i] === ":" && CELL_REF_RE.test(s)) {
        let s2 = "";
        i++; // consume ":"
        while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) s2 += input[i++];
        if (CELL_REF_RE.test(s2)) {
          tokens.push({ type: "RANGE", value: `${s}:${s2}` });
        } else {
          tokens.push({ type: "CELL_REF", value: s });
          tokens.push({ type: "IDENT", value: s2 });
        }
        continue;
      }
      if (CELL_REF_RE.test(s)) {
        tokens.push({ type: "CELL_REF", value: s });
      } else {
        tokens.push({ type: "IDENT", value: s.toUpperCase() });
      }
      continue;
    }
    // Operators
    const two = input.slice(i, i + 2);
    if (two === ">=") { tokens.push({ type: "GTE", value: ">=" }); i += 2; continue; }
    if (two === "<=") { tokens.push({ type: "LTE", value: "<=" }); i += 2; continue; }
    if (two === "<>") { tokens.push({ type: "NEQ", value: "<>" }); i += 2; continue; }
    switch (input[i]) {
      case "+": tokens.push({ type: "PLUS", value: "+" }); break;
      case "-": tokens.push({ type: "MINUS", value: "-" }); break;
      case "*": tokens.push({ type: "STAR", value: "*" }); break;
      case "/": tokens.push({ type: "SLASH", value: "/" }); break;
      case "^": tokens.push({ type: "CARET", value: "^" }); break;
      case "(": tokens.push({ type: "LPAREN", value: "(" }); break;
      case ")": tokens.push({ type: "RPAREN", value: ")" }); break;
      case ",": tokens.push({ type: "COMMA", value: "," }); break;
      case ";": tokens.push({ type: "SEMICOLON", value: ";" }); break;
      case ">": tokens.push({ type: "GT", value: ">" }); break;
      case "<": tokens.push({ type: "LT", value: "<" }); break;
      case "=": tokens.push({ type: "EQ", value: "=" }); break;
      default: i++; continue;
    }
    i++;
  }
  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

// ── Parser ───────────────────────────────────────────────────────────────────

type ASTNode =
  | { kind: "Number"; value: number }
  | { kind: "String"; value: string }
  | { kind: "CellRef"; col: number; row: number }
  | { kind: "Range"; col1: number; row1: number; col2: number; row2: number }
  | { kind: "BinOp"; op: string; left: ASTNode; right: ASTNode }
  | { kind: "UnaryMinus"; expr: ASTNode }
  | { kind: "Func"; name: string; args: ASTNode[] };

class Parser {
  private pos = 0;

  constructor(private tokens: Tok[]) {}

  private peek(): Tok {
    return this.tokens[this.pos];
  }

  private consume(): Tok {
    return this.tokens[this.pos++];
  }

  private expect(type: TokType): Tok {
    const t = this.consume();
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type}`);
    return t;
  }

  parse(): ASTNode {
    const node = this.parseComparison();
    if (this.peek().type !== "EOF") throw new Error("Unexpected token after expression");
    return node;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAddSub();
    while (["GT", "LT", "GTE", "LTE", "EQ", "NEQ"].includes(this.peek().type)) {
      const op = this.consume().value;
      const right = this.parseAddSub();
      left = { kind: "BinOp", op, left, right };
    }
    return left;
  }

  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const op = this.consume().value;
      const right = this.parseMulDiv();
      left = { kind: "BinOp", op, left, right };
    }
    return left;
  }

  private parseMulDiv(): ASTNode {
    let left = this.parsePower();
    while (this.peek().type === "STAR" || this.peek().type === "SLASH") {
      const op = this.consume().value;
      const right = this.parsePower();
      left = { kind: "BinOp", op, left, right };
    }
    return left;
  }

  private parsePower(): ASTNode {
    let left = this.parseUnary();
    if (this.peek().type === "CARET") {
      this.consume();
      const right = this.parseUnary();
      left = { kind: "BinOp", op: "^", left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.peek().type === "MINUS") {
      this.consume();
      return { kind: "UnaryMinus", expr: this.parsePrimary() };
    }
    if (this.peek().type === "PLUS") {
      this.consume();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const t = this.peek();
    if (t.type === "NUMBER") {
      this.consume();
      return { kind: "Number", value: parseFloat(t.value) };
    }
    if (t.type === "STRING") {
      this.consume();
      return { kind: "String", value: t.value };
    }
    if (t.type === "RANGE") {
      this.consume();
      const [a, b] = t.value.split(":");
      const { col: col1, row: row1 } = parseCellRef(a);
      const { col: col2, row: row2 } = parseCellRef(b);
      return { kind: "Range", col1, row1, col2, row2 };
    }
    if (t.type === "CELL_REF") {
      this.consume();
      const { col, row } = parseCellRef(t.value);
      return { kind: "CellRef", col, row };
    }
    if (t.type === "IDENT") {
      this.consume();
      const name = t.value;
      this.expect("LPAREN");
      const args: ASTNode[] = [];
      if (this.peek().type !== "RPAREN") {
        args.push(this.parseComparison());
        while (this.peek().type === "COMMA" || this.peek().type === "SEMICOLON") {
          this.consume();
          args.push(this.parseComparison());
        }
      }
      this.expect("RPAREN");
      return { kind: "Func", name, args };
    }
    if (t.type === "LPAREN") {
      this.consume();
      const expr = this.parseComparison();
      this.expect("RPAREN");
      return expr;
    }
    throw new Error(`Unexpected token: ${t.type} (${t.value})`);
  }
}

// ── Cell reference helpers ────────────────────────────────────────────────────

function parseCellRef(ref: string): { col: number; row: number } {
  const m = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) throw new Error(`Invalid cell ref: ${ref}`);
  const col = colLettersToIndex(m[1].toUpperCase());
  const row = parseInt(m[2], 10) - 1;
  return { col, row };
}

function colLettersToIndex(letters: string): number {
  let idx = 0;
  for (const ch of letters) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1;
}

// ── Evaluator ─────────────────────────────────────────────────────────────────

function toNumber(v: CellValue): number {
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function evalNode(
  node: ASTNode,
  cells: Record<string, string>,
  visiting: Set<string>,
  computeCell: (key: string) => CellValue,
): CellValue {
  switch (node.kind) {
    case "Number":
      return node.value;
    case "String":
      return node.value;
    case "CellRef": {
      const key = `${node.row}:${node.col}`;
      return computeCell(key);
    }
    case "Range": {
      // Ranges only valid as function arguments; return a sentinel (handled in Func)
      return `RANGE:${node.row1}:${node.col1}:${node.row2}:${node.col2}`;
    }
    case "UnaryMinus":
      return -toNumber(evalNode(node.expr, cells, visiting, computeCell));
    case "BinOp": {
      const l = evalNode(node.left, cells, visiting, computeCell);
      const r = evalNode(node.right, cells, visiting, computeCell);
      switch (node.op) {
        case "+": return toNumber(l) + toNumber(r);
        case "-": return toNumber(l) - toNumber(r);
        case "*": return toNumber(l) * toNumber(r);
        case "/": {
          const denom = toNumber(r);
          if (denom === 0) throw new Error("#DIV/0!");
          return toNumber(l) / denom;
        }
        case "^": return Math.pow(toNumber(l), toNumber(r));
        case ">": return toNumber(l) > toNumber(r) ? 1 : 0;
        case "<": return toNumber(l) < toNumber(r) ? 1 : 0;
        case ">=": return toNumber(l) >= toNumber(r) ? 1 : 0;
        case "<=": return toNumber(l) <= toNumber(r) ? 1 : 0;
        case "=": return l === r || toNumber(l) === toNumber(r) ? 1 : 0;
        case "<>": return l !== r && toNumber(l) !== toNumber(r) ? 1 : 0;
        default: throw new Error(`Unknown op: ${node.op}`);
      }
    }
    case "Func": {
      // Expand range args to cell values
      const expandArg = (arg: ASTNode): CellValue[] => {
        if (arg.kind === "Range") {
          const vals: CellValue[] = [];
          const rMin = Math.min(arg.row1, arg.row2);
          const rMax = Math.max(arg.row1, arg.row2);
          const cMin = Math.min(arg.col1, arg.col2);
          const cMax = Math.max(arg.col1, arg.col2);
          for (let r = rMin; r <= rMax; r++) {
            for (let c = cMin; c <= cMax; c++) {
              vals.push(computeCell(`${r}:${c}`));
            }
          }
          return vals;
        }
        return [evalNode(arg, cells, visiting, computeCell)];
      };

      switch (node.name) {
        case "SUM": {
          return node.args.flatMap(expandArg).reduce((s: number, v) => s + toNumber(v), 0);
        }
        case "AVG": {
          const all = node.args.flatMap(expandArg);
          if (all.length === 0) return 0;
          return all.reduce((s: number, v) => s + toNumber(v), 0) / all.length;
        }
        case "MIN": {
          const all = node.args.flatMap(expandArg).map(toNumber);
          return all.length === 0 ? 0 : Math.min(...all);
        }
        case "MAX": {
          const all = node.args.flatMap(expandArg).map(toNumber);
          return all.length === 0 ? 0 : Math.max(...all);
        }
        case "IF": {
          if (node.args.length < 3) throw new Error("#VALUE!");
          const cond = evalNode(node.args[0], cells, visiting, computeCell);
          return toNumber(cond) !== 0
            ? evalNode(node.args[1], cells, visiting, computeCell)
            : evalNode(node.args[2], cells, visiting, computeCell);
        }
        case "ABS": {
          return Math.abs(toNumber(evalNode(node.args[0], cells, visiting, computeCell)));
        }
        case "ROUND": {
          const val = toNumber(evalNode(node.args[0], cells, visiting, computeCell));
          const places = node.args.length > 1
            ? toNumber(evalNode(node.args[1], cells, visiting, computeCell))
            : 0;
          return Math.round(val * 10 ** places) / 10 ** places;
        }
        case "SQRT": {
          const v = toNumber(evalNode(node.args[0], cells, visiting, computeCell));
          if (v < 0) throw new Error("#VALUE!");
          return Math.sqrt(v);
        }
        default:
          throw new Error(`#NAME?`);
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function formatValue(v: CellValue): string {
  if (typeof v === "number") {
    // Avoid floating-point noise: trim to reasonable precision
    const s = v.toPrecision(12);
    const n = parseFloat(s);
    return String(n);
  }
  return String(v);
}

export function evaluateAll(
  cells: Record<string, string>,
  _rows: number,
  _cols: number,
): Record<string, string> {
  const cache: Record<string, CellValue> = {};

  const computeCell = (key: string, callStack: Set<string> = new Set()): CellValue => {
    if (key in cache) return cache[key];

    const raw = cells[key];
    if (!raw || raw === "") {
      cache[key] = "";
      return "";
    }
    if (!raw.startsWith("=")) {
      const num = parseFloat(raw);
      const val = isNaN(num) || raw.trim() !== String(num) ? raw : num;
      cache[key] = val;
      return val;
    }

    // Formula — detect circular reference
    if (callStack.has(key)) {
      cache[key] = "#CIRC!";
      return "#CIRC!";
    }

    const newStack = new Set(callStack);
    newStack.add(key);

    try {
      const formula = raw.slice(1);
      const tokens = tokenize(formula);
      const ast = new Parser(tokens).parse();
      const visiting = newStack;
      const result = evalNode(ast, cells, visiting, (refKey) => computeCell(refKey, newStack));
      const formatted = formatValue(result);
      cache[key] = formatted;
      return formatted;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const errVal = msg.startsWith("#") ? msg : "#ERROR!";
      cache[key] = errVal;
      return errVal;
    }
  };

  const result: Record<string, string> = {};
  for (const key of Object.keys(cells)) {
    result[key] = String(computeCell(key));
  }
  return result;
}
