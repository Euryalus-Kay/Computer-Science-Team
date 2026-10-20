/** The one-page Tock reference shown beside the intro test. */
export const TOCK_DOCS = `Tock is a small language. Programs run top to bottom, one statement per line.

### Values

\`\`\`tock
n <- 12            # a whole number. "<-" stores a value
name <- "ada"      # text
ok <- true         # true or false
xs <- [3, 1, 4]    # a list
say n, name        # prints: 12 ada
\`\`\`

\`=\` compares, it never stores. \`say\` prints its values separated by spaces.

### Math

| | |
|---|---|
| \`+ - *\` | as usual. \`+\` also joins text and lists |
| \`a / b\` | whole-number division, rounding down: \`7 / 2\` is \`3\`, \`-7 / 2\` is \`-4\` |
| \`a % b\` | remainder: \`7 % 3\` is \`1\` |
| \`= != < > <= >=\` | comparisons give \`true\` or \`false\` |
| \`and or not\` | combine \`true\` and \`false\` |

### Lists and text

Positions start at **1**. Negative positions count from the end.

\`\`\`tock
xs <- [10, 20, 30, 40]
say xs[1], xs[-1]     # 10 40
xs[2] <- 25           # change one item
say len(xs)           # 4
say "tock"[2]         # o
\`\`\`

### range

\`range(a, b)\` counts from \`a\` to \`b\`, **including both ends**. If \`a\` is bigger it counts down. A third value sets the step.

\`\`\`tock
range(1, 4)       # [1, 2, 3, 4]
range(5, 2)       # [5, 4, 3, 2]
range(1, 10, 4)   # [1, 5, 9]
range(9, 1, 3)    # [9, 6, 3]
\`\`\`

### Blocks

Every block closes with \`end\`.

\`\`\`tock
if n > 10 then
  say "big"
else
  say "small"
end

for x in xs do        # each item of a list (or each letter of text)
  say x
end

while n > 0 do
  n <- n - 3
end

repeat 3 times
  say "hi"
end
\`\`\`

### Pipes

\`xs |> f\` sends a list through \`f\`. Write a small function as \`x -> ...\`.

| | |
|---|---|
| \`keep(x -> test)\` | keeps items where the test is \`true\` |
| \`map(x -> value)\` | replaces each item |
| \`count(x -> test)\` | how many items pass the test |
| \`fold(start, (acc, x) -> value)\` | combines items left to right |
| \`take(n)\` | the first \`n\` items |
| \`sort\`, \`rev\`, \`sum\`, \`max\`, \`min\`, \`len\` | also work as \`sort(xs)\` |

\`\`\`tock
say range(1, 6) |> keep(x -> x % 2 = 1) |> map(x -> x * 10)
# [10, 30, 50]
say [2, 0, 2, 6] |> fold(0, (acc, d) -> acc * 10 + d)
# 2026
\`\`\`

### Input

\`read\` gives the next line of input. It is a number if the line is a number, otherwise text.

\`\`\`tock
n <- read
say n * 2
\`\`\`

### Other helpers

\`abs(n)\`, \`text(n)\` turns a value into text, \`num(t)\` turns text into a number.
`;
