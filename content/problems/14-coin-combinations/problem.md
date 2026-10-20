---
title: Coin Combinations
difficulty: medium
tags: dynamic programming
---
Count the ways to pay exactly `x` cents using coins of the given values. You may use any coin as many times as you like, and the order of coins does not matter: `1 + 2` and `2 + 1` are the same way.

The count can be huge, so print it modulo 1 000 000 007.

## Input
The first line contains `n` and `x` (1 ≤ n ≤ 100, 1 ≤ x ≤ 10⁵). The second line contains `n` distinct coin values between 1 and 10⁵.

## Output
Print the number of ways modulo 1 000 000 007.
