---
title: Postfix Calculator
difficulty: medium
tags: stacks, acsl
---
In **postfix** notation each operator follows its two operands, so `3 4 + 2 *` means `(3 + 4) * 2`.

Evaluate postfix expressions over integers with the operators `+`, `-`, `*`, `/` and `^`. Division truncates toward zero (so `-7 / 2` is `-3`). `^` raises to a non-negative power.

## Input
The first line contains `t` (1 ≤ t ≤ 1000). Each of the next `t` lines is a valid expression with tokens separated by spaces. Every intermediate value fits in a signed 64-bit integer and no division is by zero.

## Output
For each expression print its value.
