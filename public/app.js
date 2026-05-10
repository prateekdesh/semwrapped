"use strict";
// ─── Types (mirrored from src/types.ts) ──────────────────────────────────────
// ─── App state ────────────────────────────────────────────────────────────────
let studentData = null;
let currentSlide = 0;
let isAnimating = false;
let pendingSessionId = '';
let pendingUsername = '';
let pendingPassword = '';
let pendingPassword2 = '';
const TOTAL_SLIDES = 12;
const SLIDE_GRADIENTS = [
    'radial-gradient(ellipse at 65% 15%, #3730a3 0%, #1e1b4b 45%, #07060f 100%)', // 0 cold open  — indigo
    'radial-gradient(ellipse at 35% 80%, #064e3b 0%, #0a1628 55%, #000 100%)', // 1 attendance  — teal-navy
    'radial-gradient(ellipse at 75% 20%, #065f46 0%, #022c20 55%, #010d09 100%)', // 2 best        — emerald
    'radial-gradient(ellipse at 25% 80%, #7f1d1d 0%, #2d0606 55%, #0a0000 100%)', // 3 worst       — crimson
    'radial-gradient(ellipse at 50% 50%, #1e293b 0%, #0c1220 60%, #020408 100%)', // 4 heatmap     — slate
    'radial-gradient(ellipse at 50% 15%, #78350f 0%, #1f0d03 55%, #0a0400 100%)', // 5 skipped     — amber
    'radial-gradient(ellipse at 50% 85%, #1e3a8a 0%, #08142e 55%, #010510 100%)', // 6 gpa         — royal blue
    'radial-gradient(ellipse at 75% 30%, #4c1d95 0%, #160845 55%, #04000f 100%)', // 7 almost      — violet
    'radial-gradient(ellipse at 50% 25%, #451a03 0%, #1a0a00 55%, #080200 100%)', // 8 hall ticket — amber-dark
    'radial-gradient(ellipse at 30% 65%, #1a0533 0%, #0b001e 55%, #000 100%)', // 9 alter ego   — cosmic
    'radial-gradient(ellipse at 70% 70%, #172554 0%, #050912 60%, #020204 100%)', // 10 numbers    — midnight
    'radial-gradient(ellipse at 50% 0%,  #4c1d95 0%, #190430 55%, #00091e 100%)', // 11 closer     — purple-navy
];
const BAR_COLORS = [
    '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#ef4444', '#14b8a6', '#f97316',
    '#a78bfa', '#34d399',
];
const SRM_LOGO = 'https://scet.berkeley.edu/wp-content/uploads/8.-SRM-Logo.png';
// ─── DOM helpers ──────────────────────────────────────────────────────────────
function $(id) {
    return document.getElementById(id);
}
function show(id) {
    ['login-screen', 'loading-screen', 'stories-screen'].forEach((s) => {
        const el = $(s);
        el.classList.toggle('hidden', s !== id);
        el.classList.toggle('active', s === id);
    });
}
function showError(msg) {
    const el = $('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}
function hideError() {
    $('login-error').classList.add('hidden');
}
// ─── Analytics ────────────────────────────────────────────────────────────────
// Strip "[UG - FT - ACADEMIC]" style suffixes from program names
function cleanProgram(s) {
    return s.replace(/\s*\[.*?\]\s*/g, '').replace(/\s{2,}/g, ' ').trim();
}
// Normalize course codes for cross-referencing (uppercase, no spaces)
function normCode(code) {
    return code.toUpperCase().replace(/\s+/g, '');
}
// Look up attendance % for a course by code; returns null if not available
function getAttPct(courseCode, data) {
    const norm = normCode(courseCode);
    const match = data.attendance.find((a) => normCode(a.courseCode) === norm);
    return match ? match.attendancePercentage : null;
}
// Qualitative mark label using correct SRM thresholds
function markLabel(mark, maxMark) {
    if (maxMark <= 65) {
        // Internal marks (typically out of 60)
        if (mark >= maxMark * 0.834)
            return 'solid'; // ~50/60
        if (mark >= maxMark * 0.75)
            return 'decent'; // ~45/60
        if (mark >= maxMark * 0.667)
            return 'just about'; // ~40/60
        return 'rough';
    }
    const p = mark / maxMark;
    if (p >= 0.91)
        return 'O grade';
    if (p >= 0.81)
        return 'A+';
    if (p >= 0.71)
        return 'A';
    if (p >= 0.61)
        return 'B+';
    return 'passing';
}
function computeAttendance(data) {
    if (data.attendance && data.attendance.length > 0) {
        const rows = data.attendance.map((c) => ({
            name: c.courseName,
            code: c.courseCode,
            pct: c.attendancePercentage,
        }));
        const overall = rows.reduce((s, r) => s + r.pct, 0) / rows.length;
        return {
            overall,
            byCourse: [...rows].sort((a, b) => a.pct - b.pct),
            hasData: true,
        };
    }
    return { overall: 0, byCourse: [], hasData: false };
}
function markPct(c) {
    return c.maxMark > 0 ? (c.mark / c.maxMark) * 100 : 0;
}
function getBest(courses) {
    return courses.reduce((b, c) => markPct(c) > markPct(b) ? c : b, courses[0]);
}
function getWorst(courses) {
    return courses.reduce((w, c) => markPct(c) < markPct(w) ? c : w, courses[0]);
}
function attendanceArchetype(p) {
    if (p >= 90)
        return {
            title: 'The Regular',
            sub: "You went to every class. On purpose. Nobody asked you to be this person. And yet.",
            accent: '#10b981',
        };
    if (p >= 75)
        return {
            title: 'The Strategist',
            sub: 'You reverse-engineered the 75% rule and parked just above it. Technically fine. Spiritually questionable.',
            accent: '#f59e0b',
        };
    if (p >= 66)
        return {
            title: 'The Gambler',
            sub: 'You are one bad week from an exam ban. This is not a strategy. This is a cry for help.',
            accent: '#f97316',
        };
    return {
        title: 'The Ghost',
        sub: 'Professors know your name from the register. They have never confirmed your existence in person.',
        accent: '#ef4444',
    };
}
function getAlmostMoments(courses) {
    const out = [];
    for (const c of courses) {
        const targets = c.maxMark <= 65
            ? [
                { mark: Math.round(c.maxMark * 0.834), label: 'the good zone' },
                { mark: Math.round(c.maxMark * 0.75), label: 'a comfortable spot' },
                { mark: Math.round(c.maxMark * 0.667), label: 'the safe zone' },
            ]
            : [
                { mark: Math.round(0.91 * c.maxMark), label: 'an O' },
                { mark: Math.round(0.81 * c.maxMark), label: 'an A+' },
                { mark: Math.round(0.71 * c.maxMark), label: 'an A' },
                { mark: Math.round(0.61 * c.maxMark), label: 'a B+' },
            ];
        for (const t of targets) {
            const gap = Math.round((t.mark - c.mark) * 10) / 10;
            if (gap > 0 && gap <= 5) {
                out.push({ course: c, markGap: gap, label: t.label });
                break;
            }
        }
    }
    return out.sort((a, b) => a.markGap - b.markGap).slice(0, 3);
}
function alterEgo(cgpa) {
    if (cgpa >= 9.0)
        return { title: 'The Quiet Threat', desc: "Nobody saw you coming. The group chat that excludes you is scared now.", accent: '#10b981' };
    if (cgpa >= 7.5)
        return { title: 'The Consistent One', desc: 'Not flashy. Not collapsing. Just reliably there — every semester. It\'s giving "I have a plan and I\'m not telling anyone."', accent: '#3b82f6' };
    if (cgpa >= 6.0)
        return { title: 'The Everyman', desc: 'Peak average. Statistically, you are most people. Own it. Most people are fine.', accent: '#f59e0b' };
    return { title: 'The Phoenix', desc: 'Every comeback needs a low point. You\'ve found it. Setup complete. Next semester is the arc.', accent: '#f97316' };
}
function truncate(name, words = 4) {
    const parts = name.split(' ');
    return parts.length > words ? parts.slice(0, words).join(' ') + '…' : name;
}
function faFirst(fa) {
    // Get first name or "Dr. X" form from FA full name
    const parts = fa.trim().split(/\s+/);
    if (parts[0].match(/^(Dr|Prof|Mr|Ms|Mrs)\.?$/i))
        return `${parts[0]}. ${parts[1] ?? ''}`.trim();
    return parts[0];
}
// ─── Background Music (Web Audio API) ────────────────────────────────────────
const BPM = 82;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
// Cmaj7 | Am7 | Fmaj7 | Em7  (MIDI note numbers, root in octave 3)
const LOFI_PROG = [
    [48, 52, 55, 59],
    [45, 48, 52, 55],
    [41, 45, 48, 52],
    [40, 43, 47, 50],
];
const CYCLE_DUR = BAR * 2 * LOFI_PROG.length; // 8 bars total
let _actx = null;
let _mGain = null;
let _musicRunning = false;
let _muted = false;
let _loopTimer = null;
function noteHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}
function schedPad(ctx, out, midi, t, dur) {
    [[0, 'sine', 0.07], [7, 'triangle', 0.035], [-7, 'triangle', 0.035]].forEach(([det, type, vol]) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = noteHz(midi);
        osc.detune.value = det + (Math.random() - 0.5) * 5;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.55);
        g.gain.setValueAtTime(vol, t + dur - 0.9);
        g.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + dur + 0.1);
    });
}
function schedKick(ctx, out, t) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.28);
    g.gain.setValueAtTime(0.65, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.32);
}
function schedHat(ctx, out, t, vol) {
    const len = Math.ceil(ctx.sampleRate * 0.042);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
        d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.linearRampToValueAtTime(0.001, t + 0.042);
    src.connect(hpf);
    hpf.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + 0.05);
}
function schedCycle(startAt) {
    if (!_actx || !_mGain)
        return;
    const ctx = _actx;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 3200;
    lpf.Q.value = 0.6;
    lpf.connect(_mGain);
    LOFI_PROG.forEach((chord, ci) => {
        const cs = startAt + ci * BAR * 2;
        chord.forEach(m => schedPad(ctx, lpf, m, cs, BAR * 2 + 0.6));
        for (let b = 0; b < 8; b++) {
            const bt = cs + b * BEAT;
            if (b % 2 === 0)
                schedKick(ctx, _mGain, bt);
            schedHat(ctx, _mGain, bt, 0.085);
            schedHat(ctx, _mGain, bt + BEAT * 0.5, 0.048);
        }
    });
}
function startMusic() {
    if (_musicRunning)
        return;
    if (!_actx) {
        _actx = new (window.AudioContext || window.webkitAudioContext)();
        _mGain = _actx.createGain();
        _mGain.gain.value = 0.28;
        _mGain.connect(_actx.destination);
    }
    if (_actx.state === 'suspended')
        _actx.resume().catch(() => { });
    _musicRunning = true;
    const t0 = _actx.currentTime + 0.2;
    schedCycle(t0);
    function loop(prev) {
        if (!_musicRunning)
            return;
        const next = prev + CYCLE_DUR;
        schedCycle(next);
        _loopTimer = setTimeout(() => loop(next), (CYCLE_DUR - 2) * 1000);
    }
    _loopTimer = setTimeout(() => loop(t0), (CYCLE_DUR - 2) * 1000);
}
function toggleMute() {
    if (!_actx || !_mGain)
        return;
    _muted = !_muted;
    _mGain.gain.setTargetAtTime(_muted ? 0 : 0.28, _actx.currentTime, 0.4);
    const btn = document.getElementById('mute-btn');
    if (btn)
        btn.textContent = _muted ? '🔇' : '♪';
}
// ─── Slide renderers ──────────────────────────────────────────────────────────
function renderSlide(i, d) {
    const att = computeAttendance(d);
    switch (i) {
        case 0: return s0(d.profile);
        case 1: return s1(att);
        case 2: return s2(d);
        case 3: return s3(d);
        case 4: return s4(d.courses, att);
        case 5: return s5(d, att);
        case 6: return s6(d.academicRecord);
        case 7: return s7(d.courses);
        case 8: return s8(d.examTimetable, d.profile);
        case 9: return s9(d.academicRecord, d.profile);
        case 10: return s10(d, att);
        case 11: return s11(d.profile);
        default: return '';
    }
}
// 0 — Cold Open
function s0(p) {
    const program = cleanProgram(p.program || p.degree);
    const fa = faFirst(p.facultyAdvisor);
    return `
    <div class="slide-inner animate-in">
      <img src="${SRM_LOGO}" class="srm-logo-watermark" alt="SRM" loading="lazy">
      <div class="eyebrow">semester over. barely.</div>
      <div class="big-quote">let's see<br>what actually<br>happened.</div>
      <div class="divider"></div>
      <div class="name-display">${p.name}</div>
      <div class="meta-line">${program}</div>
      <div class="fa-hint">👁 ${fa} has already read the report. Brace yourself.</div>
    </div>`;
}
// 1 — Attendance Personality
function s1(att) {
    if (!att.hasData) {
        return `
      <div class="slide-inner animate-in">
        <div class="eyebrow">attendance check</div>
        <div class="archetype-title" style="color:#f59e0b">The Mystery</div>
        <div class="divider"></div>
        <div class="body-text">Your attendance data is playing hide and seek. Just like you, apparently.</div>
      </div>`;
    }
    const arch = attendanceArchetype(att.overall);
    const pctRound = Math.round(att.overall);
    const gauge75Left = 75;
    const barWidth = Math.min(pctRound, 100);
    const barColor = pctRound >= 75 ? arch.accent : '#ef4444';
    const danger = pctRound < 75
        ? `<div class="alert-tag">⚠ Below 75%. You may be barred from exams. This is not a personality trait.</div>`
        : pctRound < 80
            ? `<div class="info-tag">One bad week and the 75% wall becomes your problem. Just saying.</div>`
            : '';
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">attendance personality</div>
      <div class="huge-number" style="color:${arch.accent}">${pctRound}<span class="unit">%</span></div>
      <div class="att-gauge-wrap">
        <div class="att-gauge-track">
          <div class="att-gauge-fill" style="width:${barWidth}%;background:${barColor}"></div>
          <div class="att-gauge-limit" style="left:${gauge75Left}%"></div>
        </div>
        <div class="att-gauge-labels">
          <span></span><span class="att-limit-label">75% min</span><span></span>
        </div>
      </div>
      <div class="archetype-title" style="color:${arch.accent}">${arch.title}</div>
      <div class="body-text italic">"${arch.sub}"</div>
      ${danger}
    </div>`;
}
// 2 — Best Subject
function s2(d) {
    if (!d.courses.length)
        return emptySlide('best subject', 'No course data available.');
    const c = getBest(d.courses);
    const p = markPct(c);
    const attPct = getAttPct(c.code, d);
    const label = markLabel(c.mark, c.maxMark);
    let attLine = '';
    if (attPct !== null) {
        if (attPct < 75)
            attLine = `You only showed up <strong>${Math.round(attPct)}%</strong> of the time. And still pulled this off. Terrifying, honestly.`;
        else if (attPct >= 90)
            attLine = `<strong>${Math.round(attPct)}%</strong> attendance too. You actually tried here. It shows.`;
        else
            attLine = `<strong>${Math.round(attPct)}%</strong> attendance — the bare minimum of effort, somehow above-average results.`;
    }
    else {
        attLine = `<strong>${c.mark}/${c.maxMark}</strong>. This subject single-handedly saved your dinner table GPA conversation.`;
    }
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">your one saving grace</div>
      <div class="score-chip" style="background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.3)">
        <span class="score-mark" style="color:#10b981">${c.mark}</span>
        <span class="score-sep">/</span>
        <span class="score-max">${c.maxMark}</span>
        <span class="score-badge" style="background:#10b981">${label}</span>
      </div>
      <div class="subject-name">${truncate(c.name, 5)}</div>
      <div class="subject-code">${c.code}</div>
      <div class="divider"></div>
      <div class="body-text">Of everything you half-tried this semester, <strong>${truncate(c.name, 3)}</strong> is where you accidentally did well. ${attLine}</div>
    </div>`;
}
// 3 — Worst Subject
function s3(d) {
    if (!d.courses.length)
        return emptySlide('worst subject', 'No course data available.');
    const c = getWorst(d.courses);
    const p = markPct(c);
    const attPct = getAttPct(c.code, d);
    let copy;
    if (attPct !== null && attPct < 75 && p < 67) {
        copy = `You skipped <strong>${100 - Math.round(attPct)}%</strong> of the classes and scored <strong>${c.mark}/${c.maxMark}</strong>. We're not saying correlation is causation. We're saying look at the numbers.`;
    }
    else if (attPct !== null && attPct >= 85 && p < 67) {
        copy = `You showed up <strong>${Math.round(attPct)}%</strong> of the time and still got <strong>${c.mark}/${c.maxMark}</strong>. Presence was not the variable. Something else is.`;
    }
    else if (p < 50) {
        copy = 'This subject didn\'t just beat you. It made it personal. The rematch is next semester — if you\'re brave enough.';
    }
    else {
        copy = 'It didn\'t break you. It tried. Every lecture was a negotiation. You survived it, barely, and we respect the hustle.';
    }
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">your nemesis</div>
      <div class="score-chip" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.25)">
        <span class="score-mark" style="color:#ef4444">${c.mark}</span>
        <span class="score-sep">/</span>
        <span class="score-max">${c.maxMark}</span>
        ${p < 67 ? `<span class="score-badge" style="background:#ef4444">rough</span>` : ''}
      </div>
      <div class="subject-name">${truncate(c.name, 5)}</div>
      <div class="subject-code">${c.code}</div>
      <div class="divider"></div>
      <div class="body-text">${copy}</div>
    </div>`;
}
// 4 — Visual breakdown
function s4(courses, att) {
    const source = att.hasData ? att.byCourse : [...courses]
        .sort((a, b) => markPct(b) - markPct(a))
        .map((c) => ({ name: c.name, code: c.code, pct: markPct(c) }));
    const subtitle = att.hasData
        ? 'Every bar below 75% is a choices monument. Yours.'
        : 'Your semester, ranked. Judgement only partially withheld.';
    const bars = source.slice(0, 8).map((row, i) => {
        const danger = att.hasData && row.pct < 75;
        const color = danger ? '#ef4444' : BAR_COLORS[i % BAR_COLORS.length];
        return `
      <div class="bar-row">
        <div class="bar-labels">
          <span class="bar-name">${truncate(row.name, 3)}</span>
          <span class="bar-val" style="color:${color}">${Math.round(row.pct)}%${danger ? ' ⚠' : ''}</span>
        </div>
        <div class="bar-track">
          ${att.hasData ? `<div class="bar-limit-line" style="left:75%"></div>` : ''}
          <div class="bar-fill" style="width:${Math.min(row.pct, 100)}%;background:${color}"></div>
        </div>
      </div>`;
    }).join('');
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">your semester from above</div>
      <div class="slide-subtitle">${subtitle}</div>
      <div class="bar-chart">${bars}</div>
      ${att.hasData ? `<div class="bar-legend"><span class="bar-legend-line"></span> 75% minimum</div>` : ''}
    </div>`;
}
// 5 — Most skipped class
function s5(d, att) {
    if (att.hasData && att.byCourse.length > 0) {
        const sk = att.byCourse[0]; // sorted ascending
        const pctR = Math.round(sk.pct);
        const marks = d.courses.find((c) => normCode(c.code) === normCode(sk.code));
        const marksLine = marks
            ? ` They also scored <strong>${marks.mark}/${marks.maxMark}</strong> there. Draw your own conclusions.`
            : '';
        const dangerLine = pctR < 75
            ? `<div class="alert-tag">⚠ ${pctR}% is below the 75% exam entry requirement.</div>`
            : pctR < 80
                ? `<div class="info-tag">Just ${Math.round(sk.pct - 75).toFixed(0)} percentage points above the safety line.</div>`
                : '';
        return `
      <div class="slide-inner animate-in">
        <div class="eyebrow">most-skipped class</div>
        <div class="huge-number" style="color:#f97316">${pctR}<span class="unit">%</span></div>
        <div class="subject-name">${truncate(sk.name, 5)}</div>
        <div class="subject-code">${sk.code}</div>
        <div class="divider"></div>
        <div class="body-text"><strong>${truncate(sk.name, 3)}</strong> held lectures without you so many times, it stopped saving your seat.${marksLine}</div>
        ${dangerLine}
      </div>`;
    }
    const w = getWorst(d.courses);
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">your nemesis (no attendance data)</div>
      <div class="huge-number" style="color:#f97316">${Math.round(markPct(w))}<span class="unit">%</span></div>
      <div class="subject-name">${truncate(w.name, 5)}</div>
      <div class="divider"></div>
      <div class="body-text"><strong>${truncate(w.name, 3)}</strong> scheduled class at hours you disagreed with philosophically. You voted with your absence.</div>
    </div>`;
}
// 6 — GPA Trajectory
function s6(rec) {
    const sems = rec.semesters.filter((s) => s.sgpa > 0);
    if (sems.length === 0) {
        return `
      <div class="slide-inner animate-in">
        <div class="eyebrow">gpa trajectory</div>
        <div class="huge-number" style="color:#3b82f6">${rec.cgpa > 0 ? rec.cgpa.toFixed(2) : '—'}</div>
        <div class="stat-label">CGPA</div>
        <div class="divider"></div>
        <div class="body-text">The numbers tell a story. You're writing it in real time.</div>
      </div>`;
    }
    const last = sems[sems.length - 1];
    const prev = sems.length >= 2 ? sems[sems.length - 2] : null;
    let trendText = 'Completely flat. Same every semester. Scientists studying your GPA are bored.';
    let trendColor = '#3b82f6';
    if (prev) {
        const delta = last.sgpa - prev.sgpa;
        if (delta > 0.2) {
            trendText = `Up ${delta.toFixed(2)} from last sem. Actual growth. Don't ruin it by relaxing now.`;
            trendColor = '#10b981';
        }
        else if (delta < -0.2) {
            trendText = `Down ${Math.abs(delta).toFixed(2)} from last sem. Not your best era. We're calling it a plot twist, not a trend.`;
            trendColor = '#f97316';
        }
    }
    const maxSgpa = Math.max(...sems.map((s) => s.sgpa));
    const bars = sems.map((s) => {
        const h = Math.round((s.sgpa / (maxSgpa || 10)) * 80);
        const isCurrent = s === last;
        return `
      <div class="gpa-bar-wrap">
        <div class="gpa-val">${s.sgpa.toFixed(1)}</div>
        <div class="gpa-bar" style="height:${h}px;background:${isCurrent ? trendColor : 'rgba(59,130,246,0.3)'}"></div>
        <div class="gpa-label">S${s.semester}</div>
      </div>`;
    }).join('');
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">gpa trajectory</div>
      <div class="huge-number" style="color:${trendColor}">${rec.cgpa > 0 ? rec.cgpa.toFixed(2) : last.sgpa.toFixed(2)}</div>
      <div class="stat-label">CGPA</div>
      <div class="gpa-chart">${bars}</div>
      <div class="body-text italic">"${trendText}"</div>
    </div>`;
}
// 7 — Almost Moments
function s7(courses) {
    const moments = getAlmostMoments(courses);
    if (moments.length === 0) {
        return `
      <div class="slide-inner animate-in">
        <div class="eyebrow">almost moments</div>
        <div class="archetype-title" style="color:#a855f7">No Close Calls</div>
        <div class="divider"></div>
        <div class="body-text">You either nailed it or you didn't — no messy middles. Respect the clarity.</div>
      </div>`;
    }
    const items = moments.map((m) => `
    <div class="almost-item">
      <div class="almost-gap">${m.markGap % 1 === 0 ? m.markGap : m.markGap.toFixed(1)}</div>
      <div class="almost-info">
        <div class="almost-course">${truncate(m.course.name, 4)}</div>
        <div class="almost-threshold">${m.markGap === 1 ? '1 mark' : `${m.markGap % 1 === 0 ? m.markGap : m.markGap.toFixed(1)} marks`} from ${m.label}. We will never speak of this again.</div>
      </div>
    </div>`).join('');
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">almost moments</div>
      <div class="slide-subtitle">The universe is specific and it is cruel.</div>
      <div class="almost-list">${items}</div>
    </div>`;
}
function parseExamDate(d) {
    // "12-MAY-2026" → Date
    const months = {
        JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
        JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };
    const [day, mon, year] = d.toUpperCase().split('-');
    const m = months[mon];
    if (m === undefined)
        return new Date(NaN);
    return new Date(Number(year), m, Number(day));
}
// 8 — Exam Preview
function s8(timetable, profile) {
    const withDates = timetable.filter((e) => e.date);
    const count = withDates.length;
    const seatNo = timetable.find((e) => e.seatNo)?.seatNo ?? profile.registerNo;
    const sorted = [...withDates].sort((a, b) => {
        const da = parseExamDate(a.date);
        const db = parseExamDate(b.date);
        if (!isNaN(da.getTime()) && !isNaN(db.getTime()))
            return da.getTime() - db.getTime();
        return 0;
    });
    const next = sorted[0] ?? timetable[0];
    if (!next) {
        return `
      <div class="slide-inner animate-in">
        <div class="eyebrow">what's next</div>
        <div class="archetype-title" style="color:#fbbf24">Exam Season</div>
        <div class="divider"></div>
        <div class="body-text">You have <strong>${count}</strong> exams on the horizon. The semester's not done with you yet. Go get them.</div>
      </div>`;
    }
    const hallEntry = timetable.find((e) => e.hallNo);
    const hallNo = hallEntry?.hallNo ?? next.hallNo ?? null;
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">what's next</div>
      <div class="archetype-title" style="color:#fbbf24">Exam Season</div>
      <div class="divider"></div>
      <div class="hall-card">
        <div class="hall-label">FIRST UP</div>
        <div class="hall-subject">${truncate(next.subjectName, 6)}</div>
        <div class="hall-meta">
          ${next.date ? `<span>📅 ${next.date}</span>` : ''}
          ${next.session ? `<span>${next.session}</span>` : ''}
          ${hallNo ? `<span>Hall: ${hallNo}</span>` : ''}
        </div>
      </div>
      <div class="body-text">Seat <strong>${seatNo}</strong>. <strong>${count}</strong> paper${count !== 1 ? 's' : ''} between you and freedom. You survived the whole semester. The exams are just the receipts.</div>
    </div>`;
}
// 9 — Academic Alter Ego
function s9(rec, profile) {
    const ego = alterEgo(rec.cgpa);
    const fa = faFirst(profile.facultyAdvisor);
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">academic alter ego</div>
      <div class="huge-number" style="color:${ego.accent}">${rec.cgpa > 0 ? rec.cgpa.toFixed(2) : '—'}</div>
      <div class="stat-label">CGPA</div>
      <div class="divider"></div>
      <div class="archetype-title" style="color:${ego.accent}">${ego.title}</div>
      <div class="body-text italic">"${ego.desc}"</div>
      <div class="fa-line">${rec.cgpa >= 8.5 ? `${fa} definitely mentioned you in a staff meeting. In a good way. Probably.` : rec.cgpa >= 7.5 ? `${fa} nodded when they saw your name. That's the whole compliment.` : rec.cgpa >= 6.5 ? `${fa} has seen worse. They've also seen better. They remain professionally neutral.` : `${fa} is rooting for you. Very quietly. From a safe distance.`}</div>
    </div>`;
}
// 10 — By the Numbers
function s10(d, att) {
    const belowSafe = att.hasData ? att.byCourse.filter((c) => c.pct < 75).length : 0;
    const failedCount = d.courses.filter((c) => markPct(c) < 40).length;
    const maxTotal = d.courses.reduce((s, c) => s + c.maxMark, 0);
    const gotTotal = d.courses.reduce((s, c) => s + c.mark, 0);
    const markGap = Math.round(maxTotal - gotTotal);
    const subjectCount = d.courses.length;
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">semester by the numbers</div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-num" style="color:#f59e0b">${subjectCount}</div>
          <div class="stat-desc">subjects this sem</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" style="color:#10b981">${d.examTimetable.filter(e => e.date).length}</div>
          <div class="stat-desc">exams incoming</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" style="color:#ef4444">${att.hasData ? belowSafe : failedCount}</div>
          <div class="stat-desc">${att.hasData ? 'subjects below the 75% wall' : 'subjects that hit back'}</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" style="color:#a855f7">${markGap}</div>
          <div class="stat-desc">marks between you and the version of you that your relatives ask about</div>
        </div>
      </div>
    </div>`;
}
// 11 — The Closer
function s11(p) {
    const firstName = p.name.split(' ')[0];
    const fa = faFirst(p.facultyAdvisor);
    return `
    <div class="slide-inner animate-in">
      <img src="${SRM_LOGO}" class="srm-logo-closer" alt="SRM" loading="lazy">
      <div class="eyebrow">the closer</div>
      <div class="closer-quote">"You went through the whole thing. The 8am lectures. The last-minute submissions. The marks that stung. The subjects that didn't care. All of it. And you're still here."</div>
      <div class="divider"></div>
      <div class="closer-name">Go rest, ${firstName}. You earned it.</div>
      <div class="fa-line">${fa} didn't say anything. But they noticed. They always notice.</div>
      <button class="share-btn" id="share-btn">↗ &nbsp;Share your Wrapped</button>
      <button class="restart-btn" id="restart-btn">Start over</button>
    </div>`;
}
function emptySlide(title, msg) {
    return `
    <div class="slide-inner animate-in">
      <div class="eyebrow">${title}</div>
      <div class="body-text">${msg}</div>
    </div>`;
}
// ─── Stories engine ───────────────────────────────────────────────────────────
let slideEls = [];
function buildStories(data) {
    const container = $('slides-container');
    container.innerHTML = '';
    slideEls = [];
    for (let i = 0; i < TOTAL_SLIDES; i++) {
        const div = document.createElement('div');
        div.className = 'slide';
        div.style.background = SLIDE_GRADIENTS[i];
        div.innerHTML = renderSlide(i, data);
        container.appendChild(div);
        slideEls.push(div);
    }
    buildProgressBars();
    goToSlide(0, true);
    attachNavListeners();
    startMusic();
    document.getElementById('mute-btn')?.addEventListener('click', toggleMute);
}
function buildProgressBars() {
    const bar = $('progress-bars');
    bar.innerHTML = '';
    for (let i = 0; i < TOTAL_SLIDES; i++) {
        const seg = document.createElement('div');
        seg.className = 'prog-seg';
        seg.innerHTML = '<div class="fill"></div>';
        bar.appendChild(seg);
    }
}
function refreshProgressBars() {
    document.querySelectorAll('.prog-seg').forEach((seg, i) => {
        seg.classList.toggle('done', i < currentSlide);
        seg.classList.toggle('active', i === currentSlide);
    });
}
function goToSlide(target, instant = false) {
    if (target < 0 || target >= TOTAL_SLIDES)
        return;
    if (isAnimating && !instant)
        return;
    if (instant) {
        slideEls.forEach((el, i) => {
            el.style.transition = 'none';
            el.style.transform = i < target ? 'translateX(-100%)' : i === target ? 'translateX(0%)' : 'translateX(100%)';
            el.classList.toggle('active', i === target);
        });
        currentSlide = target;
        refreshProgressBars();
        triggerAnim(slideEls[currentSlide]);
        return;
    }
    const prev = currentSlide;
    const forward = target > prev;
    isAnimating = true;
    // Snap the incoming slide into start position without animation
    slideEls[target].style.transition = 'none';
    slideEls[target].style.transform = forward ? 'translateX(100%)' : 'translateX(-100%)';
    slideEls[target].classList.add('active');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            slideEls[prev].style.transition = `transform var(--slide-dur) var(--ease)`;
            slideEls[prev].style.transform = forward ? 'translateX(-100%)' : 'translateX(100%)';
            slideEls[target].style.transition = `transform var(--slide-dur) var(--ease)`;
            slideEls[target].style.transform = 'translateX(0%)';
            setTimeout(() => {
                slideEls[prev].classList.remove('active');
                currentSlide = target;
                isAnimating = false;
                refreshProgressBars();
                triggerAnim(slideEls[currentSlide]);
                hookSlideButtons();
            }, 360);
        });
    });
}
function triggerAnim(slideEl) {
    const inner = slideEl.querySelector('.slide-inner');
    if (!inner)
        return;
    inner.classList.remove('animate-in');
    void inner.offsetHeight; // force reflow
    inner.classList.add('animate-in');
}
let navListenersAttached = false;
function attachNavListeners() {
    if (navListenersAttached)
        return;
    navListenersAttached = true;
    $('nav-prev').addEventListener('click', () => goToSlide(currentSlide - 1));
    $('nav-next').addEventListener('click', () => goToSlide(currentSlide + 1));
    document.addEventListener('keydown', (e) => {
        if ($('stories-screen').classList.contains('hidden'))
            return;
        if (e.key === 'ArrowRight' || e.key === ' ') {
            e.preventDefault();
            goToSlide(currentSlide + 1);
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToSlide(currentSlide - 1);
        }
    });
    // Swipe support
    let tx = 0;
    const ss = $('stories-screen');
    ss.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
    ss.addEventListener('touchend', (e) => {
        const dx = tx - e.changedTouches[0].clientX;
        if (Math.abs(dx) > 48)
            goToSlide(dx > 0 ? currentSlide + 1 : currentSlide - 1);
    });
}
function hookSlideButtons() {
    document.getElementById('share-btn')?.addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({ title: 'My SemWrapped', text: 'My semester, dramatized.' }).catch(() => { });
        }
        else {
            navigator.clipboard?.writeText(window.location.href)
                .then(() => alert('Link copied to clipboard!'))
                .catch(() => alert('Share: ' + window.location.href));
        }
    });
    document.getElementById('restart-btn')?.addEventListener('click', () => {
        studentData = null;
        currentSlide = 0;
        isAnimating = false;
        navListenersAttached = false;
        pendingPassword2 = '';
        show('login-screen');
        const form = $('login-form');
        form.reset();
        $('step-captcha').classList.add('hidden');
        $('step-credentials').classList.remove('hidden');
        hideError();
    });
}
// ─── Loading screen ───────────────────────────────────────────────────────────
const LOAD_MSGS = [
    'Logging in…',
    'Reading your transcript…',
    'Locating your grades in the void…',
    'Calculating how to spin this positively…',
    'Dramatizing your attendance record…',
    'Almost ready to judge you kindly…',
];
let loadTimer = null;
function startLoader() {
    show('loading-screen');
    let idx = 0, prog = 5;
    const msgEl = $('loader-msg');
    const fillEl = $('loader-progress');
    msgEl.textContent = LOAD_MSGS[0];
    fillEl.style.width = '5%';
    loadTimer = setInterval(() => {
        idx = Math.min(idx + 1, LOAD_MSGS.length - 1);
        prog = Math.min(prog + 13, 85);
        msgEl.textContent = LOAD_MSGS[idx];
        fillEl.style.width = `${prog}%`;
    }, 1900);
}
function finishLoader() {
    if (loadTimer)
        clearInterval(loadTimer);
    $('loader-progress').style.width = '100%';
    $('loader-msg').textContent = 'Here we go.';
}
// ─── Auth flow ────────────────────────────────────────────────────────────────
async function handleStep1(e) {
    e.preventDefault();
    hideError();
    const rawUsername = $('username').value.trim();
    const username = rawUsername.replace(/@srmist\.edu\.in$/i, '');
    const password = $('password').value;
    const password2 = $('password2').value;
    if (!username || !password || !password2) {
        showError('Enter your register number and both passwords.');
        return;
    }
    pendingUsername = username;
    pendingPassword = password;
    pendingPassword2 = password2;
    const btn = $('start-btn');
    btn.disabled = true;
    btn.querySelector('.btn-label').textContent = 'Loading CAPTCHA…';
    try {
        const res = await fetch('/api/auth/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const body = await res.json();
        if (!res.ok || body.error) {
            showError(body.error ?? 'Failed to load CAPTCHA. Try again.');
            return;
        }
        pendingSessionId = body.sessionId;
        $('captcha-img').src = body.captchaImage;
        $('step-credentials').classList.add('hidden');
        $('step-captcha').classList.remove('hidden');
        $('captcha').focus();
    }
    catch {
        showError('Network error — is the server running?');
    }
    finally {
        btn.disabled = false;
        btn.querySelector('.btn-label').textContent = 'Get My Wrapped';
    }
}
async function handleStep2(e) {
    e.preventDefault();
    hideError();
    const captcha = $('captcha').value.trim();
    if (!captcha) {
        showError('Please solve the CAPTCHA first.');
        return;
    }
    const btn = $('verify-btn');
    btn.disabled = true;
    startLoader();
    try {
        const res = await fetch('/api/auth/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: pendingSessionId, username: pendingUsername, password: pendingPassword, password2: pendingPassword2, captcha }),
        });
        const body = await res.json();
        if (!res.ok || body.error) {
            finishLoader();
            show('login-screen');
            if (res.status === 401) {
                showError('Wrong credentials or CAPTCHA. Try again.');
                await refreshCaptcha();
            }
            else {
                showError(body.error ?? 'Something went wrong. Try again.');
            }
            return;
        }
        studentData = body;
        finishLoader();
        setTimeout(() => {
            show('stories-screen');
            buildStories(studentData);
        }, 550);
    }
    catch {
        finishLoader();
        show('login-screen');
        showError('Network error. Please try again.');
    }
    finally {
        btn.disabled = false;
    }
}
async function refreshCaptcha() {
    try {
        const res = await fetch('/api/auth/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const body = await res.json();
        if (body.sessionId && body.captchaImage) {
            pendingSessionId = body.sessionId;
            $('captcha-img').src = body.captchaImage;
            $('captcha').value = '';
            $('step-captcha').classList.remove('hidden');
            $('step-credentials').classList.add('hidden');
        }
    }
    catch { /* ignore */ }
}
// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    $('login-form').addEventListener('submit', (e) => {
        const captchaStep = $('step-captcha');
        if (captchaStep.classList.contains('hidden')) {
            handleStep1(e);
        }
        else {
            handleStep2(e);
        }
    });
    $('refresh-captcha').addEventListener('click', refreshCaptcha);
});
