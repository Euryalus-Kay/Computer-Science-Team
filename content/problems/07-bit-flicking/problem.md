---
title: Bit-String Flicking
difficulty: medium
tags: bits, recursion, acsl
---
Evaluate expressions on bit strings written in **prefix** notation: every operator comes before its operands.

| Operator | Meaning |
| --- | --- |
| `NOT x` | flip every bit |
| `AND x y`, `OR x y`, `XOR x y` | bitwise, position by position |
| `LSHIFT-k x`, `RSHIFT-k x` | shift by `k` places, filling with zeros |
| `LCIRC-k x`, `RCIRC-k x` | rotate by `k` places, bits wrap around |

All bit strings in one expression have the same length, and results keep that length.

For example `XOR LSHIFT-2 01101 RCIRC-1 10110` is `10100 XOR 01011` which is `11111`.

## Input
The first line contains `t` (1 ≤ t ≤ 500). Each of the next `t` lines is one expression with tokens separated by single spaces. Bit strings have 1 to 16 bits.

## Output
For each expression print the resulting bit string.
