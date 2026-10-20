import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { decks } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

const WELCOME = `# Lab CS

Computer Science Team

---

## What we do

- Weekly problems you can solve in any language
- ACSL contests through the year
- Practice rounds and team competitions

---

## The site

- **Tests**: practice rounds and contests
- **Problems**: write code, run it, submit for a verdict
- **Playground**: try code in dozens of languages
- **Drills**: quick practice on ACSL topics
- **Slides**: everything we present

---

## Test day

- Sign in and open the test before it starts
- It starts for everyone at the same moment
- Stay in the test window. Leaving it is recorded
- Some tests open in the Lab CS app

---

## Get set up

1. Sign in with the account you were given
2. Pick a new password under **Account**
3. Install the Lab CS app from the **Desktop app** page
4. Try a problem from the **Problems** page`;

const NUMBERS = `# Computer Number Systems

Binary, octal and hexadecimal

---

## Place value

Each digit is worth a power of the base.

- \`101101₂ = 32 + 8 + 4 + 1 = 45\`
- \`55₈ = 5 × 8 + 5 = 45\`
- \`2D₁₆ = 2 × 16 + 13 = 45\`

Hex digits after 9 are A = 10 through F = 15.

---

## Binary to octal and hex

Group the bits from the right.

| Binary | Groups | Result |
|---|---|---|
| 101101 | 101 101 | 55₈ |
| 101101 | 0010 1101 | 2D₁₆ |

Octal uses groups of 3. Hex uses groups of 4.

---

## Decimal to another base

Divide by the base, keep the remainders, read them from the bottom up.

\`\`\`
45 ÷ 2 = 22 r 1
22 ÷ 2 = 11 r 0
11 ÷ 2 =  5 r 1
 5 ÷ 2 =  2 r 1
 2 ÷ 2 =  1 r 0
 1 ÷ 2 =  0 r 1
\`\`\`

45 = 101101₂

---

## Adding in another base

Carry when a column reaches the base.

\`\`\`
   75₈
 + 46₈
 -----
  143₈
\`\`\`

5 + 6 = 11 = 8 + 3. Write 3, carry 1.
7 + 4 + 1 = 12 = 8 + 4. Write 4, carry 1.

---

## Try it

1. Convert 3C₁₆ to binary
2. Convert 100 to octal
3. Add 1011₂ + 111₂

---

## Answers

1. 3C₁₆ = 0011 1100 = 111100₂
2. 100 = 144₈ (64 + 32 + 4)
3. 1011₂ + 111₂ = 11 + 7 = 18 = 10010₂`;

const BITS = `# Bit-String Flicking

Working with strings of bits

---

## Bitwise operators

| A | B | AND | OR | XOR |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 | 1 |
| 1 | 0 | 0 | 1 | 1 |
| 1 | 1 | 1 | 1 | 0 |

\`NOT 10110 = 01001\`

---

## Shifts and circulates

Shifts drop bits off one end and fill the other with 0. Circulates carry them around.

\`\`\`
LSHIFT-2 01101 = 10100
RSHIFT-2 01101 = 00011
LCIRC-2  01101 = 10101
RCIRC-1  01101 = 10110
\`\`\`

---

## Order of operations

1. NOT
2. LSHIFT, RSHIFT, LCIRC, RCIRC
3. AND
4. XOR
5. OR

Parentheses first. Same level goes left to right.

---

## Work from the inside out

\`RSHIFT-1 (LCIRC-4 (RCIRC-2 01101))\`

- RCIRC-2 01101 = 01011
- LCIRC-4 01011 = 10101
- RSHIFT-1 10101 = 01010

---

## Solving for x

Undo each step in reverse.

\`LCIRC-2 x = 01101\`

Circulating right undoes circulating left:

\`x = RCIRC-2 01101 = 01011\`

---

## Try it

1. \`NOT 10101 AND 11100\`
2. \`LSHIFT-1 (10110 XOR 01100)\`
3. \`RCIRC-3 11001 OR 00100\`

---

## Answers

1. NOT first: 01010 AND 11100 = 01000
2. 10110 XOR 01100 = 11010, shifted left: 10100
3. RCIRC-3 11001 = 00111, OR 00100 = 00111`;

export const STARTER_DECKS = [
  { title: "Welcome to Lab CS", body: WELCOME },
  { title: "Computer Number Systems", body: NUMBERS },
  { title: "Bit-String Flicking", body: BITS },
];

export async function seedDecks(adminId: string) {
  const d = await db();
  for (const [i, deck] of STARTER_DECKS.entries()) {
    const [exists] = await d.select({ id: decks.id }).from(decks).where(eq(decks.title, deck.title)).limit(1);
    if (exists) continue;
    await d.insert(decks).values({ id: newId(), title: deck.title, kind: "markdown", body: deck.body, published: true, ord: i, authorId: adminId });
  }
}
