---
title: Prime Gaps
difficulty: medium
tags: math, sieve
---
For each range `[a, b]`, find the largest difference between two **consecutive** primes that both lie in the range. If the range holds fewer than two primes, the answer is `0`.

Between 10 and 30 the primes are 11, 13, 17, 19, 23, 29, so the largest gap is 29 − 23 = 6.

## Input
The first line contains `q` (1 ≤ q ≤ 50). Each of the next `q` lines contains `a` and `b` (1 ≤ a ≤ b ≤ 10⁶).

## Output
For each range print the largest gap.
