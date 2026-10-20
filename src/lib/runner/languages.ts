/**
 * Language registry shared by the editor (client) and the runner (server).
 * judge0: language id on Judge0 CE. wandbox: compiler name on wandbox.org.
 */
export type Language = {
  id: string;
  label: string;
  version: string;
  judge0: number | null;
  wandbox: string | null;
  piston?: string;
  mode: string;
  timeFactor: number;
  core?: boolean;
  template: string;
};

const PY = `import sys

def main():
    data = sys.stdin.read().split()
    # your code here
    print(" ".join(data))

main()
`;

const JAVA = `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line = in.readLine();
        // your code here
        System.out.println(line);
    }
}
`;

const CPP = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string s;
    getline(cin, s);
    // your code here
    cout << s << "\\n";
    return 0;
}
`;

const C = `#include <stdio.h>

int main(void) {
    char line[1024];
    if (fgets(line, sizeof line, stdin)) {
        // your code here
        printf("%s", line);
    }
    return 0;
}
`;

const JS = `const lines = require("fs").readFileSync(0, "utf8").split("\\n");
// your code here
console.log(lines[0]);
`;

const TS = `const lines: string[] = require("fs").readFileSync(0, "utf8").split("\\n");
// your code here
console.log(lines[0]);
`;

export const LANGUAGES: Language[] = [
  { id: "python", label: "Python", version: "3.13", judge0: 109, wandbox: "cpython-3.13.8", piston: "python", mode: "python", timeFactor: 3, core: true, template: PY },
  { id: "java", label: "Java", version: "17", judge0: 91, wandbox: "openjdk-jdk-22+36", piston: "java", mode: "java", timeFactor: 2, core: true, template: JAVA },
  { id: "cpp", label: "C++", version: "GCC 14 · C++20", judge0: 105, wandbox: "gcc-13.2.0", piston: "c++", mode: "cpp", timeFactor: 1, core: true, template: CPP },
  { id: "c", label: "C", version: "GCC 14", judge0: 103, wandbox: "gcc-13.2.0-c", piston: "c", mode: "cpp", timeFactor: 1, core: true, template: C },
  { id: "javascript", label: "JavaScript", version: "Node 22", judge0: 102, wandbox: "nodejs-20.17.0", piston: "javascript", mode: "javascript", timeFactor: 2, core: true, template: JS },
  { id: "typescript", label: "TypeScript", version: "5.6", judge0: 101, wandbox: "typescript-5.6.2", piston: "typescript", mode: "typescript", timeFactor: 2, template: TS },
  { id: "go", label: "Go", version: "1.23", judge0: 107, wandbox: "go-1.23.2", piston: "go", mode: "go", timeFactor: 1.5, template: `package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\tin := bufio.NewScanner(os.Stdin)\n\tin.Scan()\n\t// your code here\n\tfmt.Println(in.Text())\n}\n` },
  { id: "rust", label: "Rust", version: "1.85", judge0: 108, wandbox: "rust-1.82.0", piston: "rust", mode: "rust", timeFactor: 1, template: `use std::io::{self, Read};\n\nfn main() {\n    let mut s = String::new();\n    io::stdin().read_to_string(&mut s).unwrap();\n    // your code here\n    print!("{}", s);\n}\n` },
  { id: "kotlin", label: "Kotlin", version: "2.1", judge0: 111, wandbox: null, piston: "kotlin", mode: "kotlin", timeFactor: 2, template: `fun main() {\n    val line = readLine() ?: ""\n    // your code here\n    println(line)\n}\n` },
  { id: "csharp", label: "C#", version: "Mono 6.6", judge0: 51, wandbox: "dotnetcore-8.0.402", piston: "csharp", mode: "csharp", timeFactor: 2, template: `using System;\n\nclass Program {\n    static void Main() {\n        string line = Console.ReadLine();\n        // your code here\n        Console.WriteLine(line);\n    }\n}\n` },
  { id: "ruby", label: "Ruby", version: "3.4", judge0: 72, wandbox: "ruby-3.4.9", piston: "ruby", mode: "ruby", timeFactor: 3, template: `line = gets\n# your code here\nputs line\n` },
  { id: "php", label: "PHP", version: "8.3", judge0: 98, wandbox: "php-8.3.12", piston: "php", mode: "php", timeFactor: 3, template: `<?php\n$line = trim(fgets(STDIN));\n// your code here\necho $line, "\\n";\n` },
  { id: "swift", label: "Swift", version: "6.0", judge0: 83, wandbox: "swift-6.0.1", piston: "swift", mode: "swift", timeFactor: 1.5, template: `let line = readLine() ?? ""\n// your code here\nprint(line)\n` },
  { id: "lua", label: "Lua", version: "5.4", judge0: 64, wandbox: "lua-5.4.7", piston: "lua", mode: "lua", timeFactor: 3, template: `local line = io.read("l")\n-- your code here\nprint(line)\n` },
  { id: "haskell", label: "Haskell", version: "GHC 9", judge0: 61, wandbox: "ghc-9.10.1", piston: "haskell", mode: "haskell", timeFactor: 2, template: `main :: IO ()\nmain = do\n  line <- getLine\n  -- your code here\n  putStrLn line\n` },
  { id: "scala", label: "Scala", version: "3", judge0: 112, wandbox: "scala-3.5.1", piston: "scala", mode: "scala", timeFactor: 2, template: `object Main {\n  def main(args: Array[String]): Unit = {\n    val line = scala.io.StdIn.readLine()\n    // your code here\n    println(line)\n  }\n}\n` },
  { id: "dart", label: "Dart", version: "2.19", judge0: 90, wandbox: null, piston: "dart", mode: "dart", timeFactor: 2, template: `import 'dart:io';\n\nvoid main() {\n  final line = stdin.readLineSync() ?? '';\n  // your code here\n  print(line);\n}\n` },
  { id: "r", label: "R", version: "4.4", judge0: 99, wandbox: "r-4.4.1", piston: "rscript", mode: "r", timeFactor: 3, template: `con <- file("stdin")\nlines <- readLines(con)\nclose(con)\n# your code here\ncat(lines[1], "\\n")\n` },
  { id: "julia", label: "Julia", version: "1.10", judge0: null, wandbox: "julia-1.10.5", piston: "julia", mode: "julia", timeFactor: 3, template: `line = readline()\n# your code here\nprintln(line)\n` },
  { id: "bash", label: "Bash", version: "5", judge0: 46, wandbox: "bash", piston: "bash", mode: "shell", timeFactor: 3, template: `read -r line\n# your code here\necho "$line"\n` },
  { id: "perl", label: "Perl", version: "5", judge0: 85, wandbox: "perl-5.40.0", piston: "perl", mode: "perl", timeFactor: 3, template: `my $line = <STDIN>;\n# your code here\nprint $line;\n` },
  { id: "pascal", label: "Pascal", version: "FPC 3", judge0: 67, wandbox: "fpc-3.2.2", piston: "pascal", mode: "pascal", timeFactor: 1.5, template: `program Main;\nvar s: string;\nbegin\n  readln(s);\n  { your code here }\n  writeln(s);\nend.\n` },
  { id: "ocaml", label: "OCaml", version: "5", judge0: 65, wandbox: "ocaml-5.2.0", piston: "ocaml", mode: "ocaml", timeFactor: 2, template: `let () =\n  let line = read_line () in\n  (* your code here *)\n  print_endline line\n` },
  { id: "elixir", label: "Elixir", version: "1.17", judge0: 57, wandbox: "elixir-1.17.3", piston: "elixir", mode: "ruby", timeFactor: 3, template: `line = IO.gets("") |> String.trim()\n# your code here\nIO.puts(line)\n` },
  { id: "erlang", label: "Erlang", version: "OTP 27", judge0: null, wandbox: "erlang-27.1", piston: "erlang", mode: "erlang", timeFactor: 3, template: `-module(prog).\n-export([main/0]).\n\nmain() ->\n    Line = io:get_line(""),\n    io:format("~s", [Line]).\n` },
  { id: "clojure", label: "Clojure", version: "1.10", judge0: 86, wandbox: null, piston: "clojure", mode: "clojure", timeFactor: 3, template: `(let [line (read-line)]\n  ;; your code here\n  (println line))\n` },
  { id: "fsharp", label: "F#", version: ".NET", judge0: 87, wandbox: null, piston: "fsharp.net", mode: "fsharp", timeFactor: 2, template: `let line = stdin.ReadLine()\n// your code here\nprintfn "%s" line\n` },
  { id: "fortran", label: "Fortran", version: "GFortran 9", judge0: 59, wandbox: null, piston: "fortran", mode: "fortran", timeFactor: 1.5, template: `program main\n  character(len=200) :: line\n  read(*,'(A)') line\n  print '(A)', trim(line)\nend program main\n` },
  { id: "groovy", label: "Groovy", version: "4", judge0: 88, wandbox: "groovy-4.0.23", piston: "groovy", mode: "groovy", timeFactor: 3, template: `def line = System.in.newReader().readLine()\n// your code here\nprintln line\n` },
  { id: "d", label: "D", version: "DMD 2", judge0: 56, wandbox: "dmd-2.109.1", piston: "d", mode: "d", timeFactor: 1.5, template: `import std.stdio;\n\nvoid main() {\n    auto line = readln();\n    write(line);\n}\n` },
  { id: "lisp", label: "Common Lisp", version: "SBCL", judge0: 55, wandbox: "sbcl-2.4.9", piston: "commonlisp", mode: "commonlisp", timeFactor: 3, template: `(let ((line (read-line)))\n  (format t "~a~%" line))\n` },
  { id: "nim", label: "Nim", version: "2.2", judge0: null, wandbox: "nim-2.2.4", piston: "nim", mode: "python", timeFactor: 1.5, template: `let line = readLine(stdin)\n# your code here\necho line\n` },
  { id: "zig", label: "Zig", version: "0.13", judge0: null, wandbox: "zig-0.13.0", piston: "zig", mode: "rust", timeFactor: 1, template: `const std = @import("std");\n\npub fn main() !void {\n    const stdout = std.io.getStdOut().writer();\n    try stdout.print("hello\\n", .{});\n}\n` },
  { id: "crystal", label: "Crystal", version: "1.13", judge0: null, wandbox: "crystal-1.13.3", piston: "crystal", mode: "crystal", timeFactor: 1.5, template: `line = gets || ""\n# your code here\nputs line\n` },
  { id: "objc", label: "Objective-C", version: "Clang 7", judge0: 79, wandbox: null, mode: "objectivec", timeFactor: 1, template: `#import <Foundation/Foundation.h>\n\nint main() {\n    @autoreleasepool {\n        char buf[1024];\n        if (fgets(buf, sizeof buf, stdin)) printf("%s", buf);\n    }\n    return 0;\n}\n` },
  { id: "vbnet", label: "Visual Basic", version: ".NET", judge0: 84, wandbox: null, mode: "vb", timeFactor: 2, template: `Module Program\n    Sub Main()\n        Dim line As String = Console.ReadLine()\n        Console.WriteLine(line)\n    End Sub\nEnd Module\n` },
  { id: "octave", label: "Octave", version: "5", judge0: 66, wandbox: null, mode: "octave", timeFactor: 3, template: `line = fgetl(stdin);\ndisp(line);\n` },
  { id: "prolog", label: "Prolog", version: "GNU 1.4", judge0: 69, wandbox: null, mode: "text", timeFactor: 3, template: `:- initialization(main).\nmain :- write('hello'), nl, halt.\n` },
  { id: "cobol", label: "COBOL", version: "GnuCOBOL", judge0: 77, wandbox: null, mode: "cobol", timeFactor: 2, template: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. MAIN.\n       PROCEDURE DIVISION.\n           DISPLAY "hello".\n           STOP RUN.\n` },
  { id: "sql", label: "SQL", version: "SQLite", judge0: 82, wandbox: "sqlite-3.46.1", piston: "sqlite3", mode: "sql", timeFactor: 2, template: `create table t (x int);\ninsert into t values (1), (2), (3);\nselect sum(x) from t;\n` },
  { id: "asm", label: "Assembly", version: "NASM", judge0: 45, wandbox: null, mode: "gas", timeFactor: 1, template: `section .data\n    msg db "hello", 10\nsection .text\n    global _start\n_start:\n    mov eax, 4\n    mov ebx, 1\n    mov ecx, msg\n    mov edx, 6\n    int 0x80\n    mov eax, 1\n    xor ebx, ebx\n    int 0x80\n` },
];

export const LANGUAGE_BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export function getLanguage(id: string): Language | undefined {
  return LANGUAGE_BY_ID.get(id);
}

/** The five languages ACSL and USACO accept, shown first in pickers. */
export const CORE_LANGUAGES = LANGUAGES.filter((l) => l.core).map((l) => l.id);
