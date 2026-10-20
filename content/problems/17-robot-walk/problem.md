---
title: Robot Walk
difficulty: easy
tags: simulation
---
A robot starts at `(0, 0)` facing north (the positive `y` direction). It follows a string of commands:

- `F` moves one step forward
- `B` moves one step backward without turning
- `L` turns 90° left
- `R` turns 90° right

Report where it ends up and the farthest it ever got from the start, measured as `|x| + |y|`.

## Input
The first line contains `t` (1 ≤ t ≤ 100). Each of the next `t` lines is a command string of length 1 to 10⁵.

## Output
For each walk print three integers: the final `x`, the final `y`, and the farthest distance reached.
