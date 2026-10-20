---
title: Longest Climb
difficulty: hard
tags: dynamic programming, binary search
---
A hiker records the altitude at each checkpoint. Find the length of the longest climb: the longest sequence of checkpoints, kept in order but not necessarily adjacent, where each altitude is strictly higher than the one before.

For altitudes `5 2 8 6 3 6 9 7` one longest climb is `2 3 6 9`, so the answer is 4.

## Input
The first line contains `n` (1 ≤ n ≤ 6 · 10⁴). The second line contains `n` integers between 0 and 10⁹.

## Output
Print the length of the longest climb.

An O(n²) solution passes the small tests. The large ones need O(n log n).
