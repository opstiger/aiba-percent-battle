/* 04-audio — 全部声音在 OfflineAudioContext 里现场合成：150 BPM 电子鼓 + 贝斯 + 铜管 stab + 8-bit 方波琶音，
   音效按 02-shots 的 CUES 同帧触发。输出 48kHz 16bit 立体声 WAV（dataURL）。 */
(function (TR) {
"use strict";
const { TOTAL_FRAMES, FPS, BPM, rng } = TR;

TR.renderAudio = async function () {
  const CUES = TR.CUES;
  const SR = 48000, DUR = TOTAL_FRAMES / FPS;
  const ac = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);
  const T = (b) => b * 60 / BPM;
  const R = rng(777);

  /* ---------- 总线 ---------- */
  const master = ac.createGain(); master.gain.value = .32;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .18;
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -2; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .08;
  master.connect(comp); comp.connect(lim); lim.connect(ac.destination);
  // 混响
  const rev = ac.createConvolver();
  { const n = SR * 2.2, b = ac.createBuffer(2, n, SR); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / n, 3.2); } rev.buffer = b; }
  const revIn = ac.createGain(); revIn.gain.value = .5; revIn.connect(rev); rev.connect(master);
  // 音乐总线（被底鼓侧链压低）+ 音效总线
  const music = ac.createGain(); music.connect(master);
  const duck = ac.createGain(); duck.connect(music);
  const sfx = ac.createGain(); sfx.gain.value = 1; sfx.connect(master);
  // 白噪声
  const NB = ac.createBuffer(1, SR * 3, SR);
  { const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }

  /* ---------- 小工具 ---------- */
  const gainAt = (dest, t, peak, a, d, curve = "exp") => {
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (curve === "exp") g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); else g.gain.linearRampToValueAtTime(0, t + a + d);
    g.connect(dest); return g;
  };
  const osc = (type, f, t, dur, dest) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + .05); return o; };
  const noise = (t, dur, dest, rate = 1) => { const s = ac.createBufferSource(); s.buffer = NB; s.playbackRate.value = rate; s.connect(dest); s.start(t, R() * 1.5, dur + .05); return s; };
  const filt = (type, f, q, dest) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.connect(dest); return n; };
  const pan = (p, dest) => { const n = ac.createStereoPanner(); n.pan.value = p; n.connect(dest); return n; };
  const shaper = (amt, dest) => { const w = ac.createWaveShaper(), c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * amt); } w.curve = c; w.connect(dest); return w; };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const send = (node, amt) => { const g = ac.createGain(); g.gain.value = amt; node.connect(g); g.connect(revIn); };

  /* ---------- 鼓 ---------- */
  const kickTimes = [];
  function kick(t, v = 1, dest = master) {
    const g = gainAt(shaper(2.2, dest), t, .95 * v, .002, .42);
    const o = osc("sine", 150, t, .5, g); o.frequency.exponentialRampToValueAtTime(42, t + .16);
    const c = gainAt(filt("highpass", 2000, .7, dest), t, .25 * v, .001, .02); noise(t, .03, c);
    kickTimes.push(t);
  }
  function snare(t, v = 1) {
    const out = pan(0, master); send(out, .25);
    const g = gainAt(filt("bandpass", 2400, .6, out), t, .6 * v, .001, .2); noise(t, .25, g);
    const g2 = gainAt(out, t, .35 * v, .001, .12); const o = osc("triangle", 230, t, .15, g2); o.frequency.exponentialRampToValueAtTime(160, t + .1);
  }
  function clap(t, v = 1) {
    const out = pan(.05, master); send(out, .35);
    for (const d of [0, .011, .022]) { const g = gainAt(filt("bandpass", 1300, 1.2, out), t + d, .45 * v, .001, d === .022 ? .18 : .012); noise(t + d, .2, g); }
  }
  function hat(t, v = 1, open = false, p = .25) {
    const g = gainAt(filt("highpass", 8000, .5, pan(p, master)), t, .16 * v, .001, open ? .22 : .045); noise(t, open ? .3 : .06, g, 1.5);
  }
  function tom(t, f, v = 1) { const g = gainAt(shaper(1.5, master), t, .7 * v, .002, .3); const o = osc("sine", f, t, .35, g); o.frequency.exponentialRampToValueAtTime(f * .55, t + .25); send(g, .2); }

  /* ---------- 合成器 ---------- */
  const CH = { Em: [52, 55, 59, 64], C: [48, 55, 60, 64], D: [50, 54, 57, 62], B: [47, 54, 59, 63], Cmaj: [48, 52, 55, 60, 64] };
  const ROOT = { Em: 40, C: 36, D: 38, B: 35 };
  const PROG = ["Em", "C", "D", "B"];
  const chordAt = (b) => PROG[Math.floor(b / 4) % 4];
  function stab(t, notes, dur = .32, v = 1) {
    const out = ac.createGain(); out.gain.value = .13 * v; out.connect(music); send(out, .35);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 2; lp.connect(out);
    lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(700, t + dur * 1.2);
    const g = ac.createGain(); g.connect(lp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .012); g.gain.setTargetAtTime(dur > 1 ? .5 : .0, t + .05, dur * .45);
    g.gain.setTargetAtTime(0, t + dur, .12);
    for (const m of notes) for (const det of [-9, 0, 9]) { const o = osc("sawtooth", mtof(m + 12), t, dur + .6, g); o.detune.value = det; }
  }
  function bassNote(t, m, dur, v = 1) {
    const out = ac.createGain(); out.gain.value = .3 * v; out.connect(duck);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 6; lp.connect(out);
    lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ac.createGain(); g.connect(lp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .006); g.gain.setTargetAtTime(0, t + dur * .8, .03);
    osc("sawtooth", mtof(m), t, dur, g); osc("square", mtof(m - 12), t, dur, g).detune.value = 4;
    const sg = ac.createGain(); sg.gain.value = .9; sg.connect(g); osc("sine", mtof(m - 12), t, dur, sg);
  }
  function lead(t, m, dur, v = 1) {
    const out = ac.createGain(); out.gain.value = .085 * v; out.connect(duck); send(out, .45);
    const dl = ac.createDelay(); dl.delayTime.value = T(.75); const fb = ac.createGain(); fb.gain.value = .28; out.connect(dl); dl.connect(fb); fb.connect(dl); fb.connect(music);
    const lp = filt("lowpass", 3800, 1, out);
    const g = ac.createGain(); g.connect(lp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .01); g.gain.setTargetAtTime(.7, t + .03, .08); g.gain.setTargetAtTime(0, t + dur, .06);
    for (const det of [-12, 12]) { const o = osc("sawtooth", mtof(m), t, dur + .4, g); o.detune.value = det; }
    const q = osc("square", mtof(m - 12), t, dur + .4, g);
  }
  function pad(t, notes, dur, v = 1, cutoff = 900) {
    const out = ac.createGain(); out.connect(music); send(out, .6);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.06 * v, t + dur * .3); out.gain.setValueAtTime(.06 * v, t + dur * .7); out.gain.linearRampToValueAtTime(0, t + dur);
    const lp = filt("lowpass", cutoff, .7, out);
    for (const m of notes) for (const det of [-7, 7]) { const o = osc("sawtooth", mtof(m), t, dur, lp); o.detune.value = det; }
  }
  function riser(t, dur, v = 1) {
    const out = ac.createGain(); out.connect(master); send(out, .4);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(.35 * v, t + dur); out.gain.linearRampToValueAtTime(0, t + dur + .02);
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 3; bp.connect(out);
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    noise(t, dur, bp);
    const o = osc("sawtooth", 110, t, dur, filt("lowpass", 2500, 1, out)); o.frequency.exponentialRampToValueAtTime(880, t + dur);
  }

  /* 8-bit：方波琶音（像素风的声音签名） */
  function chip(t, m, dur, v = 1, type = "square") {
    const out = ac.createGain(); out.connect(duck); send(out, .2);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.05 * v, t + .004); out.gain.setTargetAtTime(0, t + dur * .6, .02);
    osc(type, mtof(m), t, dur + .1, out);
  }
  function arp(b0, b1, v = 1) {
    for (let b = b0; b < b1; b += .125) {
      const ch = CH[chordAt(b)], i = Math.round(b * 8) % 4, m = ch[[0, 1, 2, 3][i]] + 24;
      chip(T(b), m, T(.11), v);
    }
  }

  /* ---------- 编曲 ---------- */
  const RIFF_A = [76, 0, 76, 79, 0, 81, 83, 0, 83, 81, 79, 0, 76, 0, 74, 76];
  const RIFF_B = [74, 0, 74, 78, 0, 81, 83, 0, 83, 0, 81, 78, 0, 75, 0, 78];
  function groove(b0, b1, o = {}) {
    for (let b = b0; b < b1; b += .25) {
      const t = T(b), inBar = b % 4, sixteenth = Math.round((b % 1) * 4);
      if ([0, 1.5, 2, 3.75].includes(inBar) || (o.four && inBar % 1 === 0)) kick(t, 1);
      if (inBar === 1 || inBar === 3) { clap(t, .9); snare(t, .7); }
      if (sixteenth % 2 === 0) hat(t, sixteenth === 2 ? 1 : .6, inBar === 2.5, .25);
      else if (o.rolls && inBar >= 3.5 && Math.floor(b / 4) % 2 === 1) hat(t, .5, false, -.25);
      if (o.bass !== false && b % .5 === 0) {
        const ch = chordAt(b), m = ROOT[ch] + (inBar === 3.5 ? 12 : 0);
        bassNote(t, m, T(.45), o.bassV || 1);
      }
      if (o.lead && b % .5 === 0) {
        const ch = chordAt(b), riff = ch === "Em" || ch === "C" ? RIFF_A : RIFF_B, idx = Math.round((b % 8) * 2) % 16;
        const n = riff[idx];
        if (n) lead(t, n, T(.42), o.leadV || 1);
      }
      if (o.stabs && inBar === 0) stab(t, CH[chordAt(b)], .3, .9);
    }
  }
  // 前奏 0–8
  pad(T(0), [40, 47, 52], T(1.05), 1.3, 500);
  for (let b = 4; b < 8; b += .5) { hat(T(b), b % 1 ? 1 : .6); if (b % 1 === 0) kick(T(b), .9); }
  clap(T(5)); clap(T(7));
  for (let b = 7; b < 8; b += .125) snare(T(b), .25 + (b - 7) * .8);
  riser(T(6), T(2), .8);
  // 主歌 8–36
  groove(8, 16, { stabs: true });
  groove(16, 32, { stabs: true, lead: true, rolls: true });
  arp(16, 36, .9);
  arp(50, 56, 1);
  groove(32, 36, { stabs: true, lead: true, leadV: 1.2, four: true });
  // 装备 36–40：四拍底鼓 + 军鼓滚奏
  for (let b = 36; b < 39.75; b += .25) { if (b % 1 === 0) kick(T(b)); hat(T(b), .5); if (b % .5 === 0) bassNote(T(b), 40, T(.4), .9); }
  for (let b = 37; b < 39.75; b += (b < 38.5 ? .25 : .125)) snare(T(b), .3 + (b - 37) * .3);
  // 静场 40–48
  pad(T(40), [28, 40, 47], T(8), .9, 300);
  { const cr = ac.createGain(); cr.connect(master); cr.gain.setValueAtTime(0, T(40)); cr.gain.linearRampToValueAtTime(.07, T(41)); cr.gain.setValueAtTime(.07, T(47.5)); cr.gain.linearRampToValueAtTime(0, T(48));
    const lp = filt("lowpass", 420, .7, cr); noise(T(40), T(8), lp, .6); }
  // 48–50 大和弦 + 军鼓通鼓推进
  stab(T(48), CH.Cmaj, T(2) - .05, 1.3);
  for (let b = 48; b < 50; b += .25) tom(T(b), 90 + (b - 48) * 40, .4 + (b - 48) * .3);
  for (let b = 49; b < 50; b += .125) snare(T(b), .3 + (b - 49) * .6);
  // 爆发 50–56
  groove(50, 56, { stabs: true, lead: true, leadV: 1.3, bassV: 1.2, rolls: true });
  // 尾奏 56–64
  groove(56, 64, { stabs: false, bassV: .9 });
  stab(T(56), CH.Em, .5, 1.1);
  // 64 最后一下
  stab(T(64), CH.Em.concat([67]), T(6), 1.2);
  pad(T(64), [40, 47, 52, 55, 59], T(8), 1.4, 1200);
  kick(T(64), 1.2);

  // 侧链：每个底鼓把音乐总线压一下
  duck.gain.setValueAtTime(1, 0);
  for (const t of kickTimes.sort((a, b) => a - b)) { duck.gain.setValueAtTime(1, t); duck.gain.linearRampToValueAtTime(.35, t + .01); duck.gain.linearRampToValueAtTime(1, t + .22); }
  // 静场段音乐总线整体压低
  music.gain.setValueAtTime(1, T(39.7)); music.gain.linearRampToValueAtTime(.15, T(40)); music.gain.setValueAtTime(.15, T(47.8)); music.gain.linearRampToValueAtTime(1, T(48));

  /* ---------- 音效 ---------- */
  const FX = {
    boom(t) { const g = gainAt(shaper(3, sfx), t, 1, .002, 1.4); const o = osc("sine", 120, t, 1.6, g); o.frequency.exponentialRampToValueAtTime(32, t + .7); send(g, .3);
      const n = gainAt(filt("lowpass", 900, .7, sfx), t, .5, .002, .5); noise(t, .6, n); },
    bounce(t, v = 1) { const g = gainAt(sfx, t, .9 * v, .001, .18); const o = osc("sine", 190, t, .2, g); o.frequency.exponentialRampToValueAtTime(80, t + .12);
      const n = gainAt(filt("bandpass", 420, 2, sfx), t, .5 * v, .001, .09); noise(t, .12, n); send(g, .35); },
    bounceS(t) { FX.bounce(t, .6); }, bounceS2(t) { FX.bounce(t, .38); }, bounceS3(t) { FX.bounce(t, .22); },
    squeak(t) { const g = gainAt(pan(.4, sfx), t, .18, .01, .16, "lin"); const o = osc("sine", 2600, t, .2, g); const l = osc("sine", 38, t, .2, (() => { const k = ac.createGain(); k.gain.value = 380; k.connect(o.frequency); return k; })()); o.frequency.linearRampToValueAtTime(3200, t + .15); },
    whoosh(t, dur = .38, f0 = 300, f1 = 3500, v = .5) { const out = gainAt(sfx, t, v, dur * .7, dur * .3, "lin"); const bp = filt("bandpass", f0, 2.5, out); bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur); noise(t, dur, bp); send(out, .3); },
    whooshUp(t) { FX.whoosh(t, T(1), 200, 5000, .45); },
    whip(t) { FX.whoosh(t - .08, .2, 800, 5000, .5); },
    wipe(t) { FX.whoosh(t, T(.5), 200, 2500, .55); },
    catch(t) { const n = gainAt(filt("highpass", 900, .7, sfx), t, .5, .001, .05); noise(t, .06, n); const g = gainAt(sfx, t, .5, .001, .1); osc("sine", 120, t, .1, g); },
    ding(t) { const g = gainAt(pan(.3, sfx), t, .22, .002, 1.2); osc("sine", 2093, t, 1.3, g); osc("sine", 3136, t, 1.3, g); send(g, .5); },
    crash(t) { const g = gainAt(filt("highpass", 4500, .5, sfx), t, .4, .001, 2.2); noise(t, 2.3, g, 1.2); send(g, .4); },
    stab(t) { stab(t, CH.Em, .28, 1.1); },
    stabLong() {},
    stamp(t) { const g = gainAt(shaper(2, sfx), t, .9, .001, .35); const o = osc("sine", 90, t, .4, g); o.frequency.exponentialRampToValueAtTime(45, t + .2); const n = gainAt(filt("bandpass", 1800, .8, sfx), t, .5, .001, .07); noise(t, .08, n); send(g, .3); },
    shoot(t) { FX.whoosh(t - .05, .16, 900, 2600, .35); },
    swish(t) { const g = gainAt(filt("bandpass", 5200, 1.2, sfx), t, .8, .015, .32); noise(t, .4, g); const g2 = gainAt(filt("bandpass", 2400, 3, sfx), t + .05, .35, .01, .25); noise(t + .05, .3, g2); send(g, .4); },
    ignite(t) { const out = ac.createGain(); out.connect(sfx); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.45, t + .15); out.gain.setTargetAtTime(0, t + .5, .4);
      const lp = filt("lowpass", 400, 1, out); lp.frequency.exponentialRampToValueAtTime(3500, t + .4); noise(t, 1.4, lp);
      for (let i = 0; i < 16; i++) { const tt = t + R() * 1.2, g = gainAt(filt("highpass", 3000, 1, sfx), tt, .25 * R(), .001, .02); noise(tt, .03, g); } },
    fireUp(t) { FX.whoosh(t, T(.5), 150, 1800, .7); },
    gull(t) { for (const d of [0, .32]) { const g = gainAt(pan(-.5, sfx), t + d, .08, .03, .22, "lin"); const o = osc("triangle", 1900, t + d, .3, g); o.frequency.exponentialRampToValueAtTime(1150, t + d + .25); send(g, .5); } },
    stomp(t) { FX.boom(t); const n = gainAt(filt("lowpass", 1500, .7, sfx), t, .5, .005, .5); noise(t, .6, n); },
    slide(t) { FX.whoosh(t, .28, 1200, 4500, .4); FX.catch(t + .28); },
    snap(t) { const n = gainAt(filt("highpass", 1500, .8, sfx), t, .9, .001, .06); noise(t, .08, n); const g = gainAt(sfx, t, .3, .001, .08); osc("square", 900, t, .1, g); send(n, .4); },
    riser(t) { riser(t, T(1), 1); },
    riser2(t) { riser(t, T(2) - .05, 1.1); },
    heart(t) { for (const [d, v] of [[0, 1], [.16, .7]]) { const g = gainAt(filt("lowpass", 180, .7, sfx), t + d, .95 * v, .004, .22); const o = osc("sine", 62, t + d, .3, g); o.frequency.exponentialRampToValueAtTime(40, t + d + .2); } },
    hush() {},
    buzzer(t) { const g = gainAt(filt("lowpass", 2600, 1, sfx), t, .28, .005, .9, "lin"); osc("square", 233, t, .95, g); osc("square", 236, t, .95, g); osc("sawtooth", 466, t, .95, g); send(g, .3); },
    roar(t) { crowd(t, 5.5, 1); },
    clunk(t) { const g = gainAt(filt("lowpass", 700, 1, sfx), t, .8, .001, .5); noise(t, .5, g, .5); const g2 = gainAt(sfx, t, .6, .001, .25); const o = osc("square", 70, t, .3, g2); o.frequency.exponentialRampToValueAtTime(40, t + .2); send(g, .6);
      const hum = gainAt(filt("lowpass", 400, 1, sfx), t + .02, .08, .05, 1.1, "lin"); osc("sawtooth", 100, t, 1.3, hum); },
    clunkOff(t) { for (let i = 0; i < 4; i++) FX.clunk(t + i * T(.25)); },
    blip(t) { const g = gainAt(sfx, t, .18, .002, .12); const o = osc("square", 988, t, .15, g); o.frequency.setValueAtTime(1319, t + .06); send(g, .2); },
    equip(t) { FX.whoosh(t - .12, .14, 1200, 5000, .35); FX.blip(t); const g = gainAt(shaper(2, sfx), t, .7, .001, .25); const o = osc("sine", 110, t, .3, g); o.frequency.exponentialRampToValueAtTime(50, t + .2); },
    pixel(t) { for (let i = 0; i < 8; i++) { const tt = t + i * .025, g = gainAt(sfx, tt, .07, .001, .03); osc("square", 1800 - i * 180, tt, .04, g); } FX.whoosh(t, .3, 3000, 400, .3); },
    yell(t) { const out = gainAt(sfx, t, .18, .06, .9, "lin"); send(out, .5); for (const [f, q, v] of [[750, 8, 1], [1200, 10, .6], [2600, 12, .3]]) { const bp = filt("bandpass", f, q, out); const o = osc("sawtooth", 210, t, 1, bp); o.frequency.linearRampToValueAtTime(260, t + .25); o.frequency.linearRampToValueAtTime(190, t + .95); } },
  };
  function crowd(t, dur, v) {
    const out = ac.createGain(); out.connect(sfx); send(out, .6);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.55 * v, t + .25); out.gain.setTargetAtTime(.25 * v, t + 1, 1.2); out.gain.linearRampToValueAtTime(0, t + dur);
    for (const [f, q, p] of [[520, 1.2, -.4], [1100, 1.4, .3], [2300, 1.6, 0], [800, 1, .6]]) {
      const bp = filt("bandpass", f, q, pan(p, out));
      const lfo = osc("sine", 3 + R() * 4, t, dur, (() => { const k = ac.createGain(); k.gain.value = f * .08; k.connect(bp.frequency); return k; })());
      noise(t, dur, bp, .9 + R() * .2);
    }
    // 口哨
    for (let i = 0; i < 4; i++) { const tt = t + .3 + R() * 2, g = gainAt(pan(R() - .5, sfx), tt, .05, .05, .6, "lin"); const o = osc("sine", 1800 + R() * 800, tt, .7, g); o.frequency.linearRampToValueAtTime(2600 + R() * 600, tt + .3); }
  }
  for (const c of CUES) for (const n of c.sfx || []) FX[n] && FX[n](T(c.b));

  const buf = await ac.startRendering();
  return wavURL(buf);
};
TR.wavURL = wavURL;

function wavURL(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); data.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE"); str(12, "fmt ");
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, "data"); data.setUint32(40, n * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v * 32767, true); o += 2; }
  const bytes = new Uint8Array(data.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return "data:audio/wav;base64," + btoa(bin);
}
})(window.TR = window.TR || {});
