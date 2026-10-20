---
title: Base Hop
difficulty: easy
tags: number systems, acsl
---
Convert numbers between bases. Digits above 9 use the letters `A` to `Z`, so base 16 uses `0` to `F` and base 36 uses `0` to `Z`.

## Input
The first line contains `t` (1 ≤ t ≤ 1000). Each of the next `t` lines contains `value a b`: a non-negative number written in base `a`, and the base `b` to convert it to (2 ≤ a, b ≤ 36). The value has at most 30 digits and uses uppercase letters.

## Output
For each line print the value written in base `b`, using uppercase letters and no leading zeros.
