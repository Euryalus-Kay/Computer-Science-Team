import { describe, expect, it } from "vitest";
import { runTock, normalizeListAnswer, range } from "@/lib/tock";

const out = (src: string, input = "") => {
  const r = runTock(src, input);
  if (r.error) throw new Error(`line ${r.error.line}: ${r.error.message}`);
  return r.output.trim();
};

describe("tock", () => {
  it("range is inclusive and counts down", () => {
    expect(range(1, 4)).toEqual([1, 2, 3, 4]);
    expect(range(5, 2)).toEqual([5, 4, 3, 2]);
    expect(range(1, 10, 4)).toEqual([1, 5, 9]);
    expect(range(20, 0, 6)).toEqual([20, 14, 8, 2]);
    expect(range(3, 3)).toEqual([3]);
  });
  it("loops and sums", () => {
    expect(out(`total <- 0\nfor v in range(2, 8, 3) do\n  total <- total + v\nend\nsay total`)).toBe("15");
  });
  it("indexes from 1 and from the end", () => {
    expect(out(`xs <- [4, 8, 15, 16, 23, 42]\nsay xs[2] + xs[-2]`)).toBe("31");
  });
  it("pipes", () => {
    expect(out(`say range(10, 1) |> keep(n -> n % 3 = 1) |> map(n -> n / 2)`)).toBe("[5, 3, 2, 0]");
    expect(out(`say range(1, 9) |> keep(n -> n % 2 = 1) |> map(n -> n * n) |> sum`)).toBe("165");
    expect(out(`say [2, 0, 2, 6] |> fold(0, (acc, d) -> acc * 10 + d)`)).toBe("2026");
    expect(out(`say [5, 1, 4] |> sort |> rev |> take(2)`)).toBe("[5, 4]");
    expect(out(`say "banana" |> count(c -> c = "a")`)).toBe("3");
  });
  it("floor division and modulo", () => {
    expect(out(`say 7 / 2, -7 / 2, 7 % 3, -7 % 3`)).toBe("3 -4 1 2");
  });
  it("reads input", () => {
    const collatz = `n <- read
steps <- 0
while n != 1 do
  if n % 2 = 0 then
    n <- n / 2
  else
    n <- 3 * n + 1
  end
  steps <- steps + 1
end
say steps`;
    expect(out(collatz, "6\n")).toBe("8");
  });
  it("one-line if and else", () => {
    expect(out(`x <- 5\nif x > 3 then say "big" else say "small" end`)).toBe("big");
  });
  it("counts numbers containing 7", () => {
    const prog = `n <- read
count <- 0
for x in range(1, n) do
  y <- x
  found <- false
  while y > 0 do
    if y % 10 = 7 then found <- true end
    y <- y / 10
  end
  if found then count <- count + 1 end
end
say count`;
    expect(out(prog, "20")).toBe("2");
    expect(out(prog, "100")).toBe("19");
    expect(out(prog, "77")).toBe("15");
  });
  it("divisor counting", () => {
    const prog = `x <- read\nd <- range(1, x) |> keep(k -> x % k = 0)\nif len(d) = 3 then say "yes" else say "no" end`;
    expect(out(prog, "25")).toBe("yes");
    expect(out(prog, "24")).toBe("no");
  });
  it("lists are values", () => {
    expect(out(`a <- [1, 2]\nb <- a\nb[1] <- 9\nsay a, b`)).toBe("[1, 2] [9, 2]");
  });
  it("text helpers", () => {
    expect(out(`s <- "tock"\nsay s[1] + s[-1], len(s), rev(s)`)).toBe("tk 4 kcot");
    expect(out(`say text(12) + "3", num("40") + 2`)).toBe("123 42");
  });
  it("reports friendly errors with line numbers", () => {
    expect(runTock(`xs <- [1]\nsay xs[0]`).error).toEqual({ line: 2, message: "Positions start at 1, so [0] does not exist" });
    expect(runTock(`say y`).error?.message).toContain('"y" has no value');
    expect(runTock(`while true do\nend`).error?.message).toContain("ran too long");
    expect(runTock(`if 1 > 0 then\nsay 1`).error?.message).toContain('Expected "end"');
    expect(runTock(`x = 3`).error?.message).toContain("Expected a statement");
    expect(runTock(`say 1 / 0`).error?.message).toBe("Division by zero");
  });
  it("normalizes list answers", () => {
    expect(normalizeListAnswer("[5, 3, 2, 0]")).toBe("5 3 2 0");
    expect(normalizeListAnswer(" 5 3  2 0 ")).toBe("5 3 2 0");
  });
});
