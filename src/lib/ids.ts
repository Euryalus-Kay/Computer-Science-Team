import { randomBytes, createHash, randomInt } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Short random id, e.g. "k3x9q0m2a7p1". */
export function newId(len = 14): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % 36];
  return out;
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function randomSeed(): number {
  return randomInt(1, 2_000_000_000);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Human-friendly code without look-alike characters. */
export function newCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return out;
}

const WORDS = [
  "amber", "anvil", "arrow", "aspen", "atlas", "basil", "birch", "bison", "blaze", "bloom", "brook", "cedar",
  "cider", "cliff", "cloud", "cobalt", "comet", "coral", "crane", "delta", "dune", "ember", "fable", "fern",
  "finch", "fjord", "flint", "frost", "gale", "glade", "grove", "harbor", "hazel", "heron", "indigo", "iris",
  "ivory", "jade", "juniper", "kelp", "kite", "lark", "lemon", "lilac", "lotus", "lunar", "maple", "marsh",
  "meadow", "mint", "moss", "nectar", "noble", "nova", "oak", "ocean", "olive", "onyx", "opal", "orbit",
  "otter", "pearl", "pebble", "pine", "plum", "polar", "prism", "quartz", "quill", "raven", "reef", "ridge",
  "river", "robin", "sage", "sierra", "slate", "solar", "spruce", "stone", "storm", "summit", "tidal", "tulip",
  "tundra", "velvet", "violet", "willow", "wren", "zephyr",
];

/** Memorable temporary password like "maple-river-42". */
export function newPassphrase(): string {
  const a = WORDS[randomInt(0, WORDS.length)];
  let b = WORDS[randomInt(0, WORDS.length)];
  while (b === a) b = WORDS[randomInt(0, WORDS.length)];
  return `${a}-${b}-${randomInt(10, 100)}`;
}
