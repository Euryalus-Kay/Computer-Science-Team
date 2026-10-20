/** Question content for the starter tests. Pure data, safe to import in the browser. */

export type SeedItem = {
  section?: string;
  type: string;
  title: string;
  prompt: string;
  points: number;
  config?: Record<string, unknown>;
  grading?: "auto" | "ai" | "manual";
  rubric?: string;
  problem?: string;
};

const W = (widget: string, extra: Record<string, unknown> = {}) => ({ widget, ...extra });

export const INTRO_ITEMS: SeedItem[] = [
  {
    section: "Warm-up",
    type: "widget",
    title: "Dot figures",
    prompt: "The figures follow a pattern. How many dots are in figure {{ask}}?",
    points: 1,
    config: W("figures"),
  },
  {
    section: "Warm-up",
    type: "widget",
    title: "Gear train",
    prompt: "Gear A turns clockwise. Which way does gear {{last}} turn, and how many full turns does it make while A makes {{turns}}?",
    points: 2,
    config: W("gears"),
  },
  {
    section: "Warm-up",
    type: "widget",
    title: "One liar",
    prompt: "One of these servers is compromised and always lies. The other three always tell the truth. Which one is compromised?",
    points: 2,
    config: W("liars"),
  },
  {
    section: "Warm-up",
    type: "widget",
    title: "Lamp circuit",
    prompt: "Exactly one setting of the four switches lights the lamp. Set the switches to it.",
    points: 2,
    config: W("circuit"),
  },
  {
    section: "Warm-up",
    type: "widget",
    title: "Unknown function",
    prompt: "`stride` comes from a language you have never seen. Work out what it does from the examples, then give the output of the last call.",
    points: 1,
    config: W("stride"),
  },
  {
    section: "Quick fire",
    type: "mcq",
    title: "Ten rounds",
    prompt: "What does this print?\n\n```\nx = {{start}}\nrepeat 10 times:\n    x = 2 * x - 1\nprint x\n```",
    points: 1,
    config: {
      options: [],
      answer: 0,
      variants: [
        { vars: { start: 1 }, options: ["1", "1023", "1024", "2047", "513"], answer: 0 },
        { vars: { start: 2 }, options: ["1025", "1024", "2049", "2047", "513"], answer: 0 },
        { vars: { start: 3 }, options: ["2049", "2048", "3071", "1025", "4097"], answer: 0 },
      ],
    },
  },
  {
    section: "Quick fire",
    type: "mcq",
    title: "Poisoned bottle",
    prompt:
      "A lab has {{n}} bottles and exactly one is poisoned. A test strip turns red if any drop on it came from the poisoned bottle. Every strip has to be prepared at the same time and is read once, an hour later. What is the fewest strips that always finds the poisoned bottle?",
    points: 1,
    config: {
      options: [],
      answer: 0,
      variants: [
        { vars: { n: "1,000" }, options: ["10", "11", "32", "100", "999"], answer: 0 },
        { vars: { n: "500" }, options: ["9", "10", "23", "50", "499"], answer: 0 },
        { vars: { n: "2,000" }, options: ["11", "12", "45", "200", "1,999"], answer: 0 },
        { vars: { n: "100" }, options: ["7", "8", "10", "50", "99"], answer: 0 },
      ],
    },
  },
  {
    section: "Quick fire",
    type: "mcq",
    title: "Neighbor swaps",
    prompt: "You may only swap two numbers that sit next to each other. What is the fewest swaps that puts `{{list}}` in increasing order?",
    points: 1,
    config: {
      options: [],
      answer: 0,
      variants: [
        { vars: { list: "4 1 3 2" }, options: ["2", "3", "4", "5", "6"], answer: 2 },
        { vars: { list: "3 1 4 2 5" }, options: ["2", "3", "4", "5", "6"], answer: 1 },
        { vars: { list: "5 2 4 1 3" }, options: ["5", "6", "7", "8", "9"], answer: 2 },
        { vars: { list: "2 4 1 3" }, options: ["2", "3", "4", "5", "6"], answer: 1 },
      ],
    },
  },
  {
    section: "Quick fire",
    type: "mcq",
    title: "Counting calls",
    prompt:
      "```\nf(n):\n    if n < 2: return n\n    return f(n - 1) + f(n - 2)\n```\n\nHow many times is `f` called in all when you run `f({{n}})`? Count that first call too.",
    points: 2,
    config: {
      options: [],
      answer: 0,
      variants: [
        { vars: { n: 4 }, options: ["9", "5", "8", "10", "15"], answer: 0 },
        { vars: { n: 5 }, options: ["15", "8", "9", "16", "25"], answer: 0 },
        { vars: { n: 6 }, options: ["25", "13", "15", "26", "41"], answer: 0 },
      ],
    },
  },
  {
    section: "Languages",
    type: "widget",
    title: "Tock: totals",
    prompt:
      "The next questions use **Tock**, a small made-up language. Open **Reference** at the top for its one-page guide.\n\nWhat does this program print?",
    points: 1,
    config: W("tock-trace", { kind: "range-sum" }),
  },
  {
    section: "Languages",
    type: "widget",
    title: "Tock: positions",
    prompt: "What does this program print?",
    points: 1,
    config: W("tock-trace", { kind: "index" }),
  },
  {
    section: "Languages",
    type: "widget",
    title: "Tock: pipes",
    prompt: "What does this program print? Write a list as `[5, 3, 1]` or `5 3 1`.",
    points: 2,
    config: W("tock-trace", { kind: "pipe" }),
  },
  {
    section: "Languages",
    type: "widget",
    title: "Glyph",
    prompt: "Glyph is another made-up language. Its whole manual is next to the program. What does the program print?",
    points: 2,
    config: W("glyph"),
  },
  {
    section: "Terminal",
    type: "widget",
    title: "Failed logins",
    prompt: "You have a shell on `relay-7`. Which user has the most failed logins?",
    points: 1,
    config: W("terminal", { ask: "most-failed", seedKey: "terminal" }),
  },
  {
    section: "Terminal",
    type: "widget",
    title: "Door code",
    prompt: "What is the door code? The notes in the guest home folder explain how it's made.",
    points: 2,
    config: W("terminal", { ask: "door-code", seedKey: "terminal" }),
  },
  {
    section: "Terminal",
    type: "widget",
    title: "Open the door",
    prompt:
      "A different machine: you're `guest` on `lab-gate`. Open the lab door, which is run by a controller called `door`. Read each error carefully, because it tells you what to look at next.",
    points: 3,
    config: W("door"),
  },
  {
    section: "Machines",
    type: "widget",
    title: "Robot trace",
    prompt:
      "The robot starts where shown, facing the arrow. **Forward** moves one cell. If a wall or the edge is in the way, the robot stays put. Where does it end?",
    points: 2,
    config: W("robot-trace"),
  },
  {
    section: "Machines",
    type: "widget",
    title: "Rail yard",
    prompt:
      "Cars arrive in the order shown. Get them to the output in increasing order. The siding is a dead end, so the last car in is the first car out.",
    points: 2,
    config: W("rail"),
  },
  {
    section: "Machines",
    type: "widget",
    title: "Cipher",
    prompt: "Each word was encoded with the same rule. Decode the last one.",
    points: 2,
    config: W("cipher"),
  },
  {
    section: "Puzzles",
    type: "widget",
    title: "Light coin",
    prompt:
      "One of {{coins}} identical-looking coins is lighter than the rest. Find it with at most {{weighings}} weighings. The scale always answers in the least helpful way it can, so only a plan that always works will find it.",
    points: 3,
    config: W("scale", { coins: 9, weighings: 2 }),
  },
  {
    section: "Puzzles",
    type: "widget",
    title: "Fastest route",
    prompt: "Find the fastest route from {{from}} to {{to}}. Numbers are delays in milliseconds. Click nodes to build the route.",
    points: 2,
    config: W("network"),
  },
  {
    section: "Puzzles",
    type: "widget",
    title: "Lockers",
    prompt: "Four club members each use a different language and have a different locker. Use the clues to fill in the grid.",
    points: 3,
    config: W("logic-grid"),
  },
  {
    section: "Challenge",
    type: "widget",
    title: "Tock: find the input",
    prompt: "Find an input from {{lo}} to {{hi}} that makes this program print `yes`.",
    points: 3,
    config: W("tock-reverse"),
  },
  {
    section: "Challenge",
    type: "widget",
    title: "Code lock",
    prompt:
      "The lock opens with a {{digits}}-digit code with no repeated digits. After each try you see how many digits are right and in the right place, and how many are in the code but in the wrong place. You have {{maxGuesses}} tries.",
    points: 3,
    config: W("lock", { digits: 4, maxGuesses: 8 }),
  },
  {
    section: "Challenge",
    type: "widget",
    title: "Robot program",
    prompt: "Build a program that ends with the robot on the flag. You can use at most {{limit}} blocks, so you'll need repeats.",
    points: 3,
    config: W("robot-build"),
  },
  {
    section: "Challenge",
    type: "widget",
    title: "Hidden word",
    prompt: "Back on `relay-7`: what word is hidden in `archive.enc`?",
    points: 3,
    config: W("terminal", { ask: "archive", seedKey: "terminal" }),
  },
  {
    section: "Challenge",
    type: "widget",
    title: "Grid paths",
    prompt: "Moving only right or down, how many different paths go from S to E without entering a blocked cell?",
    points: 3,
    config: W("paths"),
  },
  {
    section: "Challenge",
    type: "widget",
    title: "Lights",
    prompt:
      "Pressing a light switches it and the lights directly above, below, left and right of it. Turn every light off. Full marks if you use {{limit}} presses or fewer.",
    points: 3,
    config: W("lights"),
  },
  {
    section: "Challenge",
    type: "widget",
    title: "Tock: write it",
    prompt: "Write a Tock program that reads a number `n` and prints {{task}}. For input {{sampleIn}} it prints {{sampleOut}}. Hidden tests use other values of `n`.",
    points: 5,
    config: W("tock-write", { task: "has7", tests: 5 }),
  },
  {
    section: "Challenge",
    type: "text",
    title: "Explain a strategy",
    prompt:
      "Twenty-seven coins look the same, but one is lighter. Explain how to find it with a balance scale in three weighings. A few clear sentences is enough.",
    points: 3,
    grading: "ai",
    rubric:
      "3: Splits the coins into three groups of 9, weighs two groups, and keeps the lighter pan's group (or the unweighed group if balanced). Repeats with three groups of 3, then weighs one coin against one coin to finish.\n2: Uses the three-way split correctly but a step is missing or unclear.\n1: Narrows things down in a valid way but would not always finish in three weighings.\n0: No workable method.",
    config: {
      placeholder: "Describe each weighing and what you do with the result",
      reference:
        "Weigh 9 against 9. If one side rises, the light coin is in it; if balanced, it's in the other 9. Then weigh 3 against 3 from that group the same way. Finally weigh 1 against 1 of the last three.",
    },
  },
];

export const PRACTICE_ITEMS: SeedItem[] = [
  {
    section: "Short",
    type: "numeric",
    title: "Hex to decimal",
    prompt: "Convert `{{h}}` from base 16 to base 10.",
    points: 5,
    config: {
      variants: [
        { vars: { h: "2F" }, answer: 47 },
        { vars: { h: "B7" }, answer: 183 },
        { vars: { h: "1C4" }, answer: 452 },
        { vars: { h: "FF" }, answer: 255 },
      ],
    },
  },
  {
    section: "Short",
    type: "short",
    title: "Prefix",
    prompt: "Evaluate the prefix expression `* + 3 4 - 10 6`.",
    points: 5,
    config: { accept: ["28"] },
  },
  {
    section: "Short",
    type: "mcq",
    title: "Circulate",
    prompt: "What is `LCIRC-2 10110`?",
    points: 5,
    config: { options: ["`11010`", "`01101`", "`10101`", "`11001`"], answer: 0 },
  },
  { section: "Programming", type: "code", title: "Running Total", prompt: "", points: 10, problem: "running-total", config: { partial: true } },
  { section: "Programming", type: "code", title: "Bracket Check", prompt: "", points: 20, problem: "bracket-check", config: { partial: true } },
  { section: "Programming", type: "code", title: "Coin Combinations", prompt: "", points: 30, problem: "coin-combinations", config: { partial: true } },
];

