---
title: Top Words
difficulty: easy
tags: strings, hashing, sorting
---
Find the `k` most frequent words in a text. A word is a maximal run of letters, compared without case, so `The` and `the` are the same word. Everything that is not a letter separates words.

Sort by count, highest first. Break ties alphabetically.

## Input
The first line contains `k` (1 ≤ k ≤ 50). The rest of the input is the text, at most 10⁵ characters over any number of lines. It has at least `k` distinct words.

## Output
Print `k` lines, each with a word in lowercase and its count.
