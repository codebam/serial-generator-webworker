// --- CONSTANTS ---
import { BASE85_ALPHABET } from './knowledge.js';

// --- CONSTANTS ---
export const DEFAULT_SEED = '@Uge8pzm/)}}!t8IjFw;$d;-DH;sYyj@*ifd*pw6Jyw*U';
export const ALLOWED_EXTRA = '/';
export const ALPHABET = BASE85_ALPHABET + ALLOWED_EXTRA;
export const HEADER_RE = /^(@U[^!]*!)/;
export const TG_FLAGS = { NEW: 0, TG1: 17, TG2: 33, TG3: 65, TG4: 129 };
export const RANDOM_SAFETY_MARGIN = 2000;
