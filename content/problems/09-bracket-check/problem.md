---
title: Bracket Check
difficulty: medium
tags: stacks, strings
---
Check whether the brackets `()`, `[]` and `{}` in a line are balanced. Other characters are ignored.

If the line is balanced print `OK`. Otherwise print the 1-based position of the first problem:

- a closing bracket that does not match the most recent unmatched opening bracket, or has none to match, or
- if every closing bracket matched, the leftmost opening bracket that is never closed.

## Input
The first line contains `t` (1 ≤ t ≤ 100). Each of the next `t` lines has at most 10⁵ characters and no spaces.

## Output
For each line print `OK` or a position.
