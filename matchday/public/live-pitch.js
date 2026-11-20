const LENGTH = 105;
const WIDTH = 68;
const MARGIN = 4;
const colours = ['#f2ce76', '#addcf2'];
const mix = (a, b, t) => a + (b - a) * t;
const clamp = t => Math.max(0, Math.min(1, t));
const between = (a, b, t) => ({x: mix(a.x, b.x, t), y: mix(a.y, b.y, t)});
const shotLabels = {goal: 'GOAL', save: 'SAVED', woodwork: 'WOODWORK', blocked: 'BLOCKED', miss: 'WIDE'};

function flightMs(move, matchSpeed) {
  // Typical horizontal endpoint speeds for 10–25m foot actions in the 2022
  // World Cup event sample. Decision time and the post-contact hold are separate.
  const speed = move.kind === 'shot' ? 22 : move.lofted || move.kind === 'clearance' ? 17 : 12;
  const distance = Math.hypot(move.end.x - move.start.x, move.end.y - move.start.y);
  return Math.max(move.kind === 'shot' ? 42 : 60, distance / speed * 1000 / matchSpeed);
}

export function sampleBall(from, to, progress, frameMs, matchSpeed) {
  if (to.restartSetup) return {at:to.ball, carrierId:to.carrierId};
  const motion = to.motion ?? [];
  if (!motion.length) return {at: between(from.ball, to.ball, progress), carrierId:progress < 1 ? from.carrierId : to.carrierId};
  const total = motion.reduce((sum, move) => sum + move.duration, 0);
  let elapsed = total * progress;
  let move = motion.at(-1);
  for (const leg of motion) {
    if (elapsed < leg.duration) { move = leg; break; }
    elapsed -= leg.duration;
  }
  // A recovery can be timestamped at the very end of the preceding clearance.
  const t = progress >= 1 ? 1 : total ? clamp(elapsed / (move.duration || 1)) : progress;
  const {kind, start, end, outcome} = move;
  if (kind === 'restart') return {at: t < 0.68 ? from.ball : end, carrierId:t < 0.68 ? null : move.playerId};
  if (kind === 'recovery') return {at: end, carrierId:move.playerId};
  const shot = kind === 'shot';
  const carry = kind === 'carry' || kind === 'duel';
  const legMs = frameMs * (total > 0 ? move.duration / total : 1);
  const flight = Math.min(0.92, flightMs(move, matchSpeed) / Math.max(1, legMs));
  const release = carry ? 0 : (1 - flight) * (shot ? 0.13 : 0.78);
  const impact = carry ? 0.96 : release + flight;
  const travel = clamp((t - release) / (impact - release));
  const lofted = kind === 'clearance' || move.lofted;
  const height = lift => Math.sin(Math.PI * lift) * (lofted ? 2.6 : shot ? 0.54 : 0);
  let at = between(start, end, travel);
  const lift = height(travel);
  let tail;
  if (travel > 0 && t <= impact && !carry) {
    const previous = Math.max(0, travel - (shot ? 0.42 : 0.13));
    tail = between(start, end, previous);
    tail.y -= height(previous);
  }
  if (t >= impact) {
    const settled = move.deflection ?? (move === motion.at(-1) ? to.ball : end);
    at = between(end, settled, clamp((t - impact) / (1 - impact)));
  }
  const carrierId = t >= impact ? (move === motion.at(-1) ? to.carrierId : motion[motion.indexOf(move) + 1]?.playerId)
    : carry || t <= release ? move.playerId : null;
  return {at, lift, tail, kind, carrierId, flying: !carry && t > release && t < impact,
    contactId: move.contactId, contact: end, arrival: travel,
    afterContact: clamp((t - impact) / (1 - impact)),
    label: shot ? t < impact ? 'SHOT' : shotLabels[outcome] : null,
    side: move.side, impact: shot && t >= impact ? end : null};
}

function draw(canvas, from, to, progress, roster, ball, badge) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const scale = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / (LENGTH + 2 * MARGIN), 0, 0, canvas.height / (WIDTH + 2 * MARGIN),
    canvas.width * MARGIN / (LENGTH + 2 * MARGIN), canvas.height * MARGIN / (WIDTH + 2 * MARGIN));
  ctx.fillStyle = '#153b2e';
  ctx.fillRect(-MARGIN, -MARGIN, LENGTH + 2 * MARGIN, WIDTH + 2 * MARGIN);
  for (let stripe = 0; stripe < 10; stripe++) {
    ctx.fillStyle = stripe % 2 ? '#2d664b' : '#306d50';
    ctx.fillRect(stripe * LENGTH / 10, 0, LENGTH / 10, WIDTH);
  }
  ctx.strokeStyle = '#d3e9d4b8';
  ctx.lineWidth = 0.22;
  ctx.strokeRect(0, 0, LENGTH, WIDTH);
  ctx.strokeRect(0, 13.84, 16.5, 40.32);
  ctx.strokeRect(LENGTH - 16.5, 13.84, 16.5, 40.32);
  ctx.strokeRect(0, 24.84, 5.5, 18.32);
  ctx.strokeRect(LENGTH - 5.5, 24.84, 5.5, 18.32);
  ctx.strokeRect(-2, 30.34, 2, 7.32);
  ctx.strokeRect(LENGTH, 30.34, 2, 7.32);
  ctx.beginPath();
  ctx.moveTo(LENGTH / 2, 0);
  ctx.lineTo(LENGTH / 2, WIDTH);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(LENGTH / 2, WIDTH / 2, 9.15, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = '#d3e9d4';
  for (const x of [11, LENGTH / 2, LENGTH - 11]) {
    ctx.beginPath();
    ctx.arc(x, WIDTH / 2, 0.26, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 2.05px system-ui';
  const labels = [];
  for (const [side, players] of to.teams.entries()) {
    const previous = new Map(from.teams[side].map(([id, x, y]) => [id, [x, y]]));
    for (const [id, x, y] of players) {
      const [lastX, lastY] = previous.get(id) ?? [x, y];
      let atX = mix(lastX, x, progress);
      let atY = mix(lastY, y, progress);
      if (id === ball.contactId) {
        atX = mix(mix(lastX, ball.contact.x, ball.arrival), x, ball.afterContact);
        atY = mix(mix(lastY, ball.contact.y, ball.arrival), y, ball.afterContact);
      }
      ctx.beginPath();
      ctx.arc(atX, atY, 1.38, 0, 2 * Math.PI);
      ctx.fillStyle = colours[side];
      ctx.fill();
      ctx.strokeStyle = '#132d25';
      ctx.lineWidth = 0.3;
      ctx.stroke();
      ctx.fillStyle = '#142b26';
      const player = roster.get(id);
      ctx.fillText(player?.number ?? '\u2022', atX, atY + 0.08);
      if (!player) continue;
      const carrier = id === ball.carrierId;
      if (carrier) {
        ctx.beginPath();
        ctx.arc(atX, atY, 1.85, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ddff65';
        ctx.lineWidth = 0.42;
        ctx.stroke();
      }
      labels.push({x:atX, y:atY, text:player.surname, carrier});
    }
  }
  // Place the carrier first so a nearby marker never displaces their label.
  // Work in CSS pixels to keep names readable on smaller pitches.
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const sx = width / (LENGTH + 2 * MARGIN), sy = height / (WIDTH + 2 * MARGIN);
  const fontSize = Math.min(13, Math.max(10, width / 60));
  ctx.font = '600 ' + fontSize + 'px system-ui';
  const boxes = [];
  for (const label of labels.sort((a,b) => Number(b.carrier) - Number(a.carrier))) {
    const w = ctx.measureText(label.text).width + 5, h = fontSize + 2;
    const x = Math.max(1, Math.min(width - w - 1, (label.x + MARGIN) * sx - w / 2));
    const base = (label.y + MARGIN + 1.65) * sy;
    const steps = [0, 1, -2, 2, -3, 3, -4];
    const candidates = steps.map(step => Math.max(1, Math.min(height - h - 1, base + step * (h + 1))));
    const y = candidates.find(top => boxes.every(b => x + w < b.x || x > b.x + b.w || top + h < b.y || top > b.y + b.h)) ?? candidates[0];
    boxes.push({x,y,w,h});
    if (Math.abs(y - base) > h / 2) {
      ctx.strokeStyle = '#d5e6d794';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo((label.x + MARGIN) * sx, base);
      ctx.lineTo(x + w / 2, y < base ? y + h : y);
      ctx.stroke();
    }
    ctx.fillStyle = label.carrier ? '#ddff65' : '#102c22eb';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = label.carrier ? '#102c22' : '#fff';
    ctx.fillText(label.text, x + w / 2, y + h / 2);
  }
  ctx.restore();
  const ballX = ball.at.x;
  const ballY = ball.at.y - (ball.lift ?? 0);
  if (ball.impact) {
    ctx.beginPath();
    ctx.arc(ball.impact.x, ball.impact.y, 1.1 + ball.afterContact * 2.8, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffca79';
    ctx.globalAlpha = 1 - ball.afterContact;
    ctx.lineWidth = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (ball.tail) {
    ctx.beginPath();
    ctx.moveTo(ball.tail.x, ball.tail.y);
    ctx.lineTo(ballX, ballY);
    ctx.lineCap = 'round';
    ctx.strokeStyle = ball.kind === 'shot' ? '#ffbc54' : '#e8f7eb9c';
    ctx.lineWidth = ball.kind === 'shot' ? 0.9 : 0.32;
    ctx.stroke();
  }
  if (ball.lift > 0.22) {
    ctx.beginPath();
    ctx.ellipse(ballX, ball.at.y + 0.25, 0.95, 0.42, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#122d2480';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(ballX, ballY, 0.88 + (ball.lift ?? 0) * 0.07, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#1b231e';
  ctx.lineWidth = 0.31;
  ctx.stroke();
  if (badge) {
    const textSize = Math.max(2.3, 11 * (LENGTH + 2 * MARGIN) / width);
    const boxHeight = textSize + 2;
    ctx.font = 'bold ' + textSize + 'px system-ui';
    const box = ctx.measureText(badge.label).width + 3.7;
    const x = badge.side === 'home' ? LENGTH - box - 1 : 1;
    ctx.fillStyle = '#16281ff2';
    ctx.fillRect(x, 1, box, boxHeight);
    ctx.fillStyle = '#ffcb72';
    ctx.fillRect(x, 1, 0.55, boxHeight);
    ctx.fillText(badge.label, x + box / 2 + 0.25, 1 + boxHeight / 2);
  }
}

export function animatePitch(canvas, onCommentary) {
  let from, latest, path = [], animation = 0, badge = null;
  let roster = new Map();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const render = now => {
    animation = 0;
    if (!from) return;
    while (path.length && (path[0].until <= now || reducedMotion.matches)) {
      from = path.shift().frame;
      if (from.commentary) onCommentary?.(from.commentary);
      const strike = from.motion?.find(move => move.kind === 'shot');
      if (strike) badge = {side: strike.side, label: shotLabels[strike.outcome], until: now + 900};
    }
    const next = path[0];
    const progress = next ? clamp((now - next.begin) / (next.until - next.begin)) : 1;
    const ball = next ? sampleBall(from, next.frame, progress, next.until - next.begin, next.matchSpeed) : {at: from.ball, carrierId:from.carrierId};
    if (ball.label) badge = {side: ball.side, label: ball.label, until: now + 900};
    if (badge?.until <= now) badge = null;
    draw(canvas, from, next?.frame ?? from, progress, roster, ball, badge);
    if (next || badge) animation = requestAnimationFrame(render);
  };

  const resize = new ResizeObserver(() => {
    if (!animation) animation = requestAnimationFrame(render);
  });
  resize.observe(canvas);
  return {
    update(frames, teams, matchSpeed) {
      roster = new Map(teams.flatMap(team => team.players.map(player => [player.id,
        {number:player.number, surname:player.name?.trim().split(/\s+/).at(-1) ?? String(player.number)}])));
      let fresh = frames.filter(frame => frame.seq > (latest?.seq ?? -1));
      if (!fresh.length) return;
      const now = performance.now();
      const cut = fresh.findLastIndex(frame => frame.cut);
      if (!latest || fresh[0].seq !== latest.seq + 1 || cut >= 0) {
        const index = cut >= 0 ? cut : fresh.length - 1;
        from = latest = fresh[index];
        onCommentary?.(from.commentary, true);
        fresh = fresh.slice(index + 1);
        path = [];
        badge = null;
      }
      let begin = Math.max(now, path.at(-1)?.until ?? 0);
      // Keep the currently playing pass when a poll or touchline command arrives.
      // Only accelerate new material when the retained buffer has built up.
      const catchUp = Math.max(1, (begin - now + (fresh.at(-1)?.second - latest.second || 0)
        * 1000 / matchSpeed) / 2300);
      for (const frame of fresh) {
        const shot = frame.motion?.some(move => move.kind === 'shot');
        const flights = frame.motion?.filter(move => ['shot', 'pass', 'cross', 'cutback', 'clearance'].includes(move.kind)) ?? [];
        const minFlightMs = flights.reduce((sum, move) => sum + flightMs(move, matchSpeed), 0);
        const duration = Math.max(shot ? 520 : 85, minFlightMs / 0.92,
          Math.min(1800, (frame.second - latest.second) * 1000 / matchSpeed / catchUp));
        path.push({frame, begin, until: begin + duration, matchSpeed});
        begin += duration;
        latest = frame;
      }
      if (!animation) animation = requestAnimationFrame(render);
    },
    close() {
      cancelAnimationFrame(animation);
      resize.disconnect();
    }
  };
}
