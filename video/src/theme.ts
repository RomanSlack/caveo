// Caveo "Craft Box" tokens (hex conversions of the OKLCH values in app/static/styles.css) + film timing.
import {loadFont as loadFredoka} from '@remotion/google-fonts/Fredoka';
import {loadFont as loadFigtree} from '@remotion/google-fonts/Figtree';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';

export const C = {
  kraft: '#caa377',
  paper: '#fefaf1',
  paper2: '#faf3e6',
  ink: '#312317',
  inkSoft: '#655447',
  line: '#dfd6c9',
  stitch: 'rgba(160,125,85,0.55)',
  green: '#267b4c',
  greenHi: '#48a260',
  greenWash: '#d5f5da',
  red: '#de3d34',
  redHi: '#fa6b52',
  redInk: '#a9231e',
  redWash: '#ffe6e1',
  sun: '#faca4b',
  sunInk: '#8d5e00',
  sky: '#61afda',
  felt: '#13252a',
  feltFg: '#ece7dd',
  feltMuted: '#b6c8c9',
  vultr: '#007bfc',
};

export const F = {
  display: loadFredoka('normal', {weights: ['500', '600', '700']}).fontFamily,
  body: loadFigtree('normal', {weights: ['400', '500', '600', '700']}).fontFamily,
  mono: loadMono('normal', {weights: ['500', '700']}).fontFamily,
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Narration lines (video/script.html, 14 lines). Frames @30fps, measured from Roman's cut take (build/edl.json).
// Re-sync: set each to the real length of that line in Roman's take (face.mp4); everything below follows.
export const LINES = {
  l1: 247, // face full: "If your business pays bills ... pay this new account."
  l2: 266, // the numbers: $3 billion, then $123,000 per hit
  l3: 259, // the new twist: AI reads invoices, hidden white text
  l4: 113, // the solution: "So I built Caveo ... an airlock for your invoices."
  l5: 299, // how it works: invoice comes in, carried into the sealed computer
  l6: 282, // the chamber: blocks, then the computer gets wiped
  l7: 59, // live app (Summit)
  l8: 253, // the bank change (Brightline, live)
  l9: 236, // who decides (Brightline, live, Look closer)
  l10: 209, // real inbox (live)
  l11: 157, // craft an attack (live)
  l12: 303, // on Vultr: architecture
  l13: 206, // proof: red team score
  l14: 139, // face full: end card
};

// Presenter (Roman's webcam) per segment: full size on the left of the graphics, or shrunk into a corner.
export type Corner = 'bl' | 'br' | 'tl' | 'tr';
export type Seg = {id: string; kind: 'motion' | 'live'; frames: number; label: string; presenter: 'full' | Corner; clip?: string; from?: number; rate?: number}; // from: clip start (s), rate: playback speed
const L = LINES;
export const SEGMENTS: Seg[] = [
  {id: 'hook', kind: 'motion', frames: L.l1 + L.l2 + L.l3 + L.l4, label: 'Lines 1-4: problem, numbers, twist, Caveo', presenter: 'full'},
  {id: 'flow', kind: 'motion', frames: L.l5 + L.l6, label: 'Lines 5-6: inbox to Chamber, blocks, wiped', presenter: 'bl'},
  {id: 'summit', kind: 'live', frames: L.l7, label: 'Line 7: real app, Summit', presenter: 'bl', clip: 'live/app-summit.mp4', from: 10.4, rate: 1},
  {id: 'brightline', kind: 'live', frames: L.l8 + L.l9, label: 'Lines 8-9: Brightline, Look closer', presenter: 'bl', clip: 'live/app-brightline.mp4', from: 4.5, rate: 1},
  {id: 'inbox', kind: 'live', frames: L.l10, label: 'Line 10: real inbox', presenter: 'bl', clip: 'live/app-inbox.mp4', from: 1.0, rate: 1.5},
  {id: 'craft', kind: 'live', frames: L.l11, label: 'Line 11: craft an attack', presenter: 'bl', clip: 'live/app-craft.mp4', from: 3.0, rate: 2.4},
  {id: 'arch', kind: 'motion', frames: L.l12 + L.l13, label: 'Lines 12-13: on Vultr, proof', presenter: 'bl'},
  {id: 'end', kind: 'motion', frames: L.l14, label: 'Line 14: end card', presenter: 'full'},
];
export const segStart = (id: string) => {
  let f = 0;
  for (const s of SEGMENTS) {
    if (s.id === id) return f;
    f += s.frames;
  }
  throw new Error(`no segment ${id}`);
};
export const TOTAL_FRAMES = SEGMENTS.reduce((a, s) => a + s.frames, 0); // 3165 = 1:45.5 with the estimates above

// Beats inside scenes (local frames), derived from the line lengths.
const half = Math.round(L.l2 / 2); // "$3 billion" sentence, then "$123,000 every time" sentence
export const HOOK = {
  email: [0, L.l1],
  billions: [L.l1, L.l1 + half],
  average: [L.l1 + half, L.l1 + L.l2],
  invoice: [L.l1 + L.l2, L.l1 + L.l2 + L.l3],
  title: [L.l1 + L.l2 + L.l3, L.l1 + L.l2 + L.l3 + L.l4],
} as const;
export const ARCH = {diagram: [0, L.l12], score: [L.l12, L.l12 + L.l13]} as const;

// face.mp4 is the film's master clock: film frame N = face.mp4 frame N + FACE_OFFSET.
export const FACE_OFFSET = 0;

export const CARDS = [
  {n: 1, title: "It opens the attachment, so you don't."},
  {n: 2, title: "It can't be talked into paying."},
  {n: 3, title: 'Email it yourself.'},
];
