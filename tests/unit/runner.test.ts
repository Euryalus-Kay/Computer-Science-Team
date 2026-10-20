import { describe, expect, it } from "vitest";
import { outputsMatch, runBatch, verdictOf } from "@/lib/runner";
import { LANGUAGES } from "@/lib/runner/languages";

describe("outputsMatch", () => {
  it("tokens ignores whitespace layout", () => {
    expect(outputsMatch("1  2\n3\n", "1 2 3")).toBe(true);
    expect(outputsMatch("1 2", "1 2 3")).toBe(false);
  });
  it("lines keeps line structure but trims trailing spaces", () => {
    expect(outputsMatch("a \nb\n\n", "a\nb", "lines")).toBe(true);
    expect(outputsMatch("a b", "a\nb", "lines")).toBe(false);
  });
  it("float tolerates rounding", () => {
    expect(outputsMatch("3.1415926", "3.14159265", "float")).toBe(true);
    expect(outputsMatch("3.15", "3.14", "float")).toBe(false);
  });
  it("exact only forgives one trailing newline", () => {
    expect(outputsMatch("x\n", "x", "exact")).toBe(true);
    expect(outputsMatch("x ", "x", "exact")).toBe(false);
  });
});

describe("languages", () => {
  it("every language can run somewhere", () => {
    for (const l of LANGUAGES) expect(l.judge0 !== null || l.wandbox !== null).toBe(true);
  });
  it("ids are unique", () => {
    expect(new Set(LANGUAGES.map((l) => l.id)).size).toBe(LANGUAGES.length);
  });
});

const net = process.env.RUNNER_NETWORK === "1";
describe.skipIf(!net)("runner (network)", () => {
  const limits = { timeMs: 2000, memoryMb: 256 };
  it("runs python on two inputs", async () => {
    const r = await runBatch("python", "print(sum(map(int, input().split())))", ["1 2", "5 5"], limits);
    expect(r.map((x) => x.stdout.trim())).toEqual(["3", "10"]);
  }, 60_000);
  it("detects compile errors in C++", async () => {
    const r = await runBatch("cpp", "int main( { return 0; }", [""], limits);
    expect(verdictOf(r[0], "", "tokens")).toBe("CE");
  }, 60_000);
  it("detects time limit", async () => {
    const r = await runBatch("python", "while True: pass", [""], { timeMs: 500, memoryMb: 128 });
    expect(r[0].status).toBe("timeout");
  }, 60_000);
  it("java with public class Main", async () => {
    const r = await runBatch("java", LANGUAGES.find((l) => l.id === "java")!.template, ["hello"], limits);
    expect(r[0].stdout.trim()).toBe("hello");
  }, 60_000);
  it("falls back to wandbox when forced", async () => {
    process.env.RUNNER = "wandbox";
    const r = await runBatch("cpp", LANGUAGES.find((l) => l.id === "cpp")!.template, ["abc"], limits);
    delete process.env.RUNNER;
    expect(r[0].provider).toBe("wandbox");
    expect(r[0].stdout.trim()).toBe("abc");
  }, 60_000);
});
