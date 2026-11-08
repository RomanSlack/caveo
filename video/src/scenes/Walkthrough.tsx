import React from 'react';
import {Easing, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, F, LINES} from '../theme';
import {clamp, Kraft, Latch, Paper, shake, Sticker, useIn, VultrPill, Words} from '../components/ui';

/*
 Lines 5-6 of the script: simplified product flow, Roman boxed bottom-left (keep x<480, y>690 clear).
 Real strings: inbox subjects from data/inbox/*.json, hosts from data/attachments/SummitOffice_Invoice_88213.html,
 finding titles from app/policy.py as produced on caveo.work (case-6c579418).
*/

const ROWS = [
  {from: 'Northwind AR', subject: 'Invoice INV-20419 for PO-7781', color: '#2f4f6f'},
  {from: 'Brightline Logistics Billing', subject: 'URGENT: Updated remittance details', color: '#0b6e4f'},
  {from: 'Peak Freight Partners', subject: 'Invoice PF-3391 - view online', color: '#7a4b2a'},
];
const NEW = {from: 'Summit Office Co', subject: 'Your invoice #88213 is ready', preview: 'Open the secure viewer to see it', color: '#8a2be2'};

const IN_X = 110;
const IN_Y = 96;
const IN_W = 700;
const ROW_H = 112;
const LIST_Y = IN_Y + 110; // first row top

// Chamber box
const CH_X = 1000;
const CH_Y = 90;
const CH_W = 840;
const CH_H = 900;
const ROOM = {x: 30, y: 130, w: CH_W - 60, h: 640}; // relative to chamber

// Beat frames, word-locked to Roman's take (build/narr_words.json). Line 5 starts at 29.50s, line 6 at 39.47s.
// Line 5: "An invoice comes in" 0.2s, "Instead of opening it on your computer" 1.5s, "Caveo opens it inside a sealed
// throwaway computer" 3.5s, "on Vultr" 6.6s, "No internet" 7.2s, "no passwords" 8.1s, "nothing to steal" 9.2s.
const T = {newMail: 6, cursor: 40, click: 76, lift: 100, doorsOpen: 102, land: 128, drop: 132, doorsShut: 144, vultr: 196, glass: LINES.l5 + 2};
const NO_AT = [214, 242, 274]; // No internet / no passwords / nothing to steal
const L6 = LINES.l5;
// Line 6: "Then it watches" 0.1s, "steal your logins" 1.7s, "sneak data out" 2.9s, "fake Microsoft sign-in page" 4.6s,
// "All blocked" 6.2s, "gets wiped" 8.9s.
const WATCH_AT = L6 + 4;
const STICK_AT = [50, 86, 136].map((x) => L6 + x);
const ALL_AT = L6 + 184;
const WIPED_AT = L6 + 262;

const Avatar: React.FC<{name: string; color: string; size?: number}> = ({name, color, size = 56}) => (
  <div style={{width: size, height: size, borderRadius: '50%', background: color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: F.display, fontWeight: 700, fontSize: size * 0.48, flexShrink: 0}}>
    {name[0]}
  </div>
);

const Row: React.FC<{r: {from: string; subject: string; color: string; preview?: string}; unread?: boolean; style?: React.CSSProperties}> = ({r, unread, style}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 20, height: ROW_H, padding: '0 26px', borderRadius: 18, ...style}}>
    {unread ? <div style={{width: 14, height: 14, borderRadius: '50%', background: C.sky, flexShrink: 0}} /> : <div style={{width: 14, flexShrink: 0}} />}
    <Avatar name={r.from} color={r.color} />
    <div style={{minWidth: 0}}>
      <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 28, color: C.ink, whiteSpace: 'nowrap'}}>{r.from}</div>
      <div style={{fontFamily: F.body, fontWeight: unread ? 700 : 500, fontSize: 24, color: unread ? C.ink : C.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{r.subject}</div>
    </div>
  </div>
);

const Cursor: React.FC<{x: number; y: number; press: number}> = ({x, y, press}) => (
  <svg width="54" height="54" viewBox="0 0 24 24" style={{position: 'absolute', left: x, top: y, transform: `scale(${1 - press * 0.18})`, transformOrigin: '0 0', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))'}}>
    <path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.4 L18 13.4 Z" fill="#fff" stroke={C.ink} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const STICKERS = ['Steal your logins', 'Sneak data out', 'Fake sign-in page'];
const NOS = ['No internet', 'No passwords', 'Nothing to steal'];

const InboxAndChamber: React.FC = () => {
  const f = useCurrentFrame();
  // New mail drops in at the top, pushing the list down.
  const nm = interpolate(f, [T.newMail, T.newMail + 12], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
  // Cursor path to the new row, then a click.
  const cp = interpolate(f, [T.cursor, T.click - 4], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const cx = interpolate(cp, [0, 1], [560, IN_X + 380]);
  const cy = interpolate(cp, [0, 1], [700, LIST_Y + 52]);
  const press = interpolate(f, [T.click, T.click + 3, T.click + 7], [0, 1, 0], clamp);
  const sel = f >= T.click;
  // Flight into the Chamber.
  const fl = interpolate(f, [T.lift, T.land], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const startX = IN_X + 20;
  const startY = LIST_Y;
  const endX = CH_X + CH_W / 2 - 330;
  const endY = CH_Y + ROOM.y + 160;
  const fx = startX + (endX - startX) * fl;
  const fy = startY + (endY - startY) * fl - Math.sin(Math.PI * fl) * 200;
  const drop = interpolate(f, [T.drop, T.drop + 8], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const fScale = interpolate(fl, [0, 1], [1.04, 0.7]) * (1 - drop * 0.5);
  // Doors: open, take the file, slam, then go to glass so we can watch inside.
  const open = interpolate(f, [T.doorsOpen, T.doorsOpen + 10], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const shut = interpolate(f, [T.doorsShut, T.doorsShut + 5], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const doorOpen = open * (1 - shut);
  const glass = interpolate(f, [T.glass, T.glass + 10], [1, 0.12], clamp);
  const sealed = useIn(T.doorsShut + 6, 8, Easing.out(Easing.back(2)));
  const wipe = interpolate(f, [WIPED_AT - 4, WIPED_AT + 6], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const stage = interpolate(f, [T.land + 4, T.land + 24], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const nosOut = interpolate(f, [T.glass, T.glass + 8], [1, 0], clamp);
  const scan = interpolate(f, [WATCH_AT, WATCH_AT + 45], [0, 1], {...clamp, extrapolateRight: 'extend'}) % 1;
  // Impacts: door slam, each sticker, the destroyed seal.
  const hits = [T.doorsShut + 5, ...NO_AT, ...STICK_AT, ALL_AT, WIPED_AT];
  const sh = hits.reduce((a, h) => {
    const s = shake(f, h, h === WIPED_AT ? 18 : 7);
    return {x: a.x + s.x, y: a.y + s.y};
  }, {x: 0, y: 0});

  return (
    <Kraft>
      {/* Inbox */}
      <div style={{position: 'absolute', left: IN_X, top: IN_Y, width: IN_W, opacity: 1 - stage, transform: `translateX(${-260 * stage}px)`}}>
        <Paper style={{padding: '30px 22px 26px', height: 110 + ROW_H * 4 + 30}}>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 12px 18px'}}>
            <span style={{fontFamily: F.display, fontWeight: 700, fontSize: 46, color: C.ink}}>Inbox</span>
          </div>
          <div style={{position: 'relative', height: ROW_H * 4}}>
            {ROWS.map((r, i) => (
              <Row key={r.from} r={r} style={{position: 'absolute', left: 0, right: 0, top: (i + nm) * ROW_H}} />
            ))}
            {f >= T.newMail && f < T.lift ? (
              <Row
                r={NEW}
                unread
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: (nm - 1) * 60,
                  opacity: Math.min(1, nm * 2),
                  background: sel ? '#e3f1fa' : C.paper2,
                  outline: sel ? `4px solid ${C.sky}` : 'none',
                }}
              />
            ) : null}
            {f >= T.lift ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: ROW_H, borderRadius: 18, border: `3px dashed ${C.stitch}`}} /> : null}
          </div>
        </Paper>
        {f >= T.newMail && f < T.lift ? (
          <div style={{position: 'absolute', right: 36, top: 96}}>
            <Sticker at={T.newMail + 6} rotate={6} size={24} bg={C.sky}>
              NEW
            </Sticker>
          </div>
        ) : null}
      </div>

      {/* Chamber */}
      <div style={{position: 'absolute', left: CH_X, top: CH_Y, width: CH_W, height: CH_H, transform: `translate(${sh.x - 330 * stage}px, ${sh.y - 20 * stage}px) scale(${1 + 0.06 * stage})`, transformOrigin: '50% 0'}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 30, background: C.felt, overflow: 'hidden', boxShadow: '0 26px 60px rgba(40,25,10,0.45)'}}>
          <div style={{position: 'absolute', inset: 0, backgroundImage: `url(${staticFile('img/felt.webp')})`, backgroundSize: '700px', opacity: 0.9}} />
          {/* hazard tape */}
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 38, background: `repeating-linear-gradient(-45deg, ${C.sun} 0 26px, #1a1a1a 26px 52px)`}} />
          <div style={{position: 'absolute', left: 34, right: 34, top: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{fontFamily: F.display, fontWeight: 700, fontSize: 44, color: C.feltFg}}>The Chamber</span>
            <div style={{transform: `scale(${1 + 0.5 * interpolate(f, [T.vultr, T.vultr + 4, T.vultr + 14], [0, 1, 0], clamp)})`, transformOrigin: '100% 50%'}}>
              <VultrPill size={30} />
            </div>
          </div>
          {/* room */}
          <div style={{position: 'absolute', left: ROOM.x, top: ROOM.y, width: ROOM.w, height: ROOM.h, borderRadius: 20, background: 'rgba(0,0,0,0.32)', boxShadow: 'inset 0 6px 24px rgba(0,0,0,0.6)', overflow: 'hidden'}}>
            {/* scan line while it watches */}
            {f >= WATCH_AT && f < WIPED_AT ? (
              <div style={{position: 'absolute', left: 0, right: 0, top: scan * ROOM.h, height: 6, background: C.sun, boxShadow: `0 0 26px ${C.sun}`, opacity: 0.7}} />
            ) : null}
            {/* stickers inside, one per attack Roman names */}
            <div style={{position: 'absolute', inset: 0, opacity: 1 - wipe, transform: `translateY(${wipe * -60}px) scale(${1 + wipe * 0.1})`}}>
              {STICKERS.map((t, i) => (
                <div key={t} style={{position: 'absolute', left: [30, 120, 50][i], top: 40 + i * 140}}>
                  <Sticker at={STICK_AT[i]} rotate={[-4, 3, -2][i]} size={44}>
                    {'BLOCKED: ' + t}
                  </Sticker>
                </div>
              ))}
              <div style={{position: 'absolute', left: 24, top: 452}}>
                <Sticker at={ALL_AT} rotate={-6} size={60} bg={C.ink} color={C.sun}>
                  ALL BLOCKED
                </Sticker>
              </div>
            </div>
            <div style={{position: 'absolute', right: 10, bottom: 0, opacity: 1 - wipe}}>
              {f < ALL_AT ? <Latch pose="latch3-inspect" at={WATCH_AT} height={230} bob={false} /> : <Latch pose="latch2-alarm" at={ALL_AT - 9} height={230} bob={false} />}
            </div>
            {/* doors */}
            {(['l', 'r'] as const).map((side) => (
              <div
                key={side}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: ROOM.w / 2 + 2,
                  [side === 'l' ? 'left' : 'right']: 0,
                  background: `linear-gradient(${side === 'l' ? 90 : 270}deg, #3b4a4f, #56676d)`,
                  borderRight: side === 'l' ? '4px solid #1c2629' : undefined,
                  borderLeft: side === 'r' ? '4px solid #1c2629' : undefined,
                  transform: `translateX(${(side === 'l' ? -1 : 1) * doorOpen * (ROOM.w / 2)}px)`,
                  opacity: glass,
                }}
              />
            ))}
          </div>
          {/* "No internet / no passwords / nothing to steal" slapped on the shut doors, on Roman's words */}
          <div style={{position: 'absolute', left: ROOM.x + 40, top: ROOM.y + 60, opacity: nosOut}}>
            {NOS.map((t, i) => (
              <div key={t} style={{marginBottom: 34, marginLeft: i * 60}}>
                <Sticker at={NO_AT[i]} rotate={[-3, 2, -2][i]} size={50} bg={C.paper} color={C.ink}>
                  {'✕ ' + t}
                </Sticker>
              </div>
            ))}
          </div>
          {/* sealed label */}
          <div style={{position: 'absolute', left: 34, top: ROOM.y + ROOM.h + 22, display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 4, width: CH_W - 68, whiteSpace: 'nowrap', opacity: sealed, transform: `scale(${0.8 + 0.2 * sealed})`, transformOrigin: '0 50%'}}>
            <span style={{width: 18, height: 18, borderRadius: '50%', background: C.greenHi, boxShadow: `0 0 14px ${C.greenHi}`}} />
            <span style={{fontFamily: F.body, fontWeight: 700, fontSize: 30, color: C.feltFg}}>
              Sealed · <span style={{color: C.sun}}>throwaway computer on Vultr</span>
            </span>
          </div>
        </div>
        {/* destroyed seal */}
        <div style={{position: 'absolute', left: 70, top: 340}}>
          <Sticker at={WIPED_AT} rotate={-8} size={72} bg={C.sun} color={C.ink}>
            Computer wiped
          </Sticker>
        </div>
      </div>

      {/* the email in flight */}
      {f >= T.lift && f < T.drop + 8 ? (
        <div
          style={{
            position: 'absolute',
            left: fx,
            top: fy + drop * 90,
            width: IN_W - 44,
            transform: `scale(${fScale}) rotate(${Math.sin(Math.PI * fl) * 7}deg)`,
            transformOrigin: '0 0',
            opacity: 1 - drop,
          }}
        >
          <Row r={NEW} unread style={{background: C.paper, boxShadow: '0 24px 40px rgba(40,25,10,0.45)'}} />
        </div>
      ) : null}

      {f < T.lift + 6 ? <Cursor x={cx} y={cy} press={press} /> : null}
    </Kraft>
  );
};

const FLAGS = ['Attachment tried to read browser data', 'Attachment tried to contact 5 outside location(s)', 'Attachment asks for a password'];

const Verdict: React.FC = () => {
  const f = useCurrentFrame();
  const card = useIn(0, 12, Easing.out(Easing.exp));
  return (
    <Kraft>
      <div style={{position: 'absolute', left: 560, top: 70, width: 1260, transform: `translateX(${(1 - card) * 900}px)`}}>
        <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 30, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.ink, marginBottom: 18}}>
          <Words text="Here's what it found" at={4} stagger={2} />
        </div>
        <Paper style={{padding: '50px 60px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
            <Avatar name="Summit" color={NEW.color} size={64} />
            <div>
              <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 42, color: C.ink}}>Summit Office Co</div>
              <div style={{fontFamily: F.mono, fontWeight: 500, fontSize: 22, color: C.inkSoft}}>SummitOffice_Invoice_88213.html</div>
            </div>
          </div>
          <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 40, color: C.ink, marginTop: 30, display: 'flex', gap: 34}}>
            {[
              ['8', 'attempts blocked', C.redInk],
              ['4', 'red flags', C.redInk],
              ['0', 'secrets leaked', C.green],
            ].map(([n, l, col], i) => {
              const p = interpolate(f, [16 + i * 5, 26 + i * 5], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
              return (
                <span key={l} style={{display: 'inline-flex', alignItems: 'baseline', gap: 10, transform: `scale(${p})`, opacity: Math.min(1, p * 2), transformOrigin: '0 50%'}}>
                  <span style={{fontSize: 64, color: col}}>{n}</span>
                  {l}
                </span>
              );
            })}
          </div>
          <div style={{marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12}}>
            {FLAGS.map((t, i) => {
              const p = interpolate(f, [38 + i * 6, 48 + i * 6], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
              return (
                <div key={t} style={{display: 'flex', alignItems: 'center', gap: 18, background: C.redWash, borderRadius: 14, padding: '16px 22px', opacity: p, transform: `translateX(${(1 - p) * 60}px)`}}>
                  <span style={{fontFamily: F.body, fontWeight: 800, fontSize: 20, letterSpacing: '0.1em', color: '#fff', background: C.red, borderRadius: 8, padding: '6px 10px'}}>CRITICAL</span>
                  <span style={{fontFamily: F.body, fontWeight: 600, fontSize: 30, color: C.ink}}>{t}</span>
                </div>
              );
            })}
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 20, marginTop: 34, opacity: useIn(62, 10)}}>
            <span style={{fontFamily: F.display, fontWeight: 700, fontSize: 34, color: '#fff', background: `linear-gradient(${C.redHi}, ${C.red})`, padding: '18px 40px', borderRadius: 999, boxShadow: '0 8px 18px rgba(170,40,30,0.35)'}}>Reject</span>
            <span style={{fontFamily: F.display, fontWeight: 700, fontSize: 34, color: C.ink, background: C.paper2, padding: '18px 40px', borderRadius: 999, border: `3px solid ${C.line}`}}>Call supplier</span>
            <span style={{fontFamily: F.body, fontWeight: 600, fontSize: 24, color: C.inkSoft, marginLeft: 10}}>Approve is locked: quarantined invoices can't be paid.</span>
          </div>
        </Paper>
        <div style={{position: 'absolute', right: -10, top: 40}}>
          <Sticker at={8} rotate={7} size={66}>
            QUARANTINED
          </Sticker>
        </div>
      </div>
    </Kraft>
  );
};

// Not in the film (the live Summit clip shows the real verdict); kept as a standalone composition.
export const VERDICT_FRAMES = 230;
export {Verdict};

export const Walkthrough: React.FC = () => <InboxAndChamber />;
