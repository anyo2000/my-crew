// ========================================
// My Crew v6 — 쉬는 애는 조용히, 일하는 애 집중
// ========================================

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const W = 1280;
const H = 720;
canvas.width = W;
canvas.height = H;

let tick = 0;
let crewData = [];

// ========================================
// 일할 때 말풍선 — 2초마다 깜빡이며 순환
// ========================================

const WORK_BUBBLES = [
  // 이모지만 있는 것 (파일명과 교대)
  { emoji: '🔥', text: '' },
  { emoji: '💪', text: '' },
  { emoji: '⚡', text: '' },
  { emoji: '🧠', text: '' },
  { emoji: '🎯', text: '' },
  // 짧은 멘트
  { emoji: '🔥', text: '집중...' },
  { emoji: '💡', text: '아 이거다' },
  { emoji: '🤯', text: '복잡하네' },
  { emoji: '✨', text: '거의 다 됐어' },
  { emoji: '⏳', text: '좀 걸리겠다' },
  { emoji: '🧮', text: '계산 중...' },
  { emoji: '🤔', text: '어디까지 했더라' },
  { emoji: '😤', text: '바쁘다 바빠' },
  { emoji: '🎯', text: '중요한 거야' },
  { emoji: '💪', text: '열심히 해야지' },
  { emoji: '🔧', text: '수정 중...' },
  { emoji: '👀', text: '확인 중...' },
];

// 쉴 때 — 대부분 아무것도 안 보여줌, 가끔만
const IDLE_ICONS = ['☕', '💤', '😴', '🙆', '📱'];

// ========================================
// 버블 상태 관리
// ========================================

const bubbleStates = {};

function getBubble(member) {
  const key = member.id || member.name;
  const isWorking = member.action === 'working';

  if (!bubbleStates[key]) {
    bubbleStates[key] = {
      wasWorking: isWorking,
      workIdx: Math.floor(Math.random() * WORK_BUBBLES.length),
      showFile: false,
      blinkTimer: 0,
      // idle 상태
      idleShowTimer: 0,
      idleIcon: '',
      idleVisible: false,
      // 전환 효과
      justStarted: false,
      justFinished: false,
      transitionTimer: 0,
    };
  }

  const s = bubbleStates[key];

  // 상태 전환 감지
  if (s.wasWorking !== isWorking) {
    if (isWorking && !s.wasWorking) {
      s.justStarted = true;
      s.justFinished = false;
      s.transitionTimer = 120; // 약 2초 표시
    } else if (!isWorking && s.wasWorking) {
      s.justFinished = true;
      s.justStarted = false;
      s.transitionTimer = 150; // 약 2.5초 표시
    }
    s.wasWorking = isWorking;
  }

  // 전환 메시지 (일 시작/끝)
  if (s.transitionTimer > 0) {
    s.transitionTimer--;
    if (s.justStarted) {
      return { type: 'transition', emoji: '📬', text: '일감 들어왔다!', visible: true };
    }
    if (s.justFinished) {
      return { type: 'transition', emoji: '✅', text: '끝! 수고~', visible: true };
    }
  } else {
    s.justStarted = false;
    s.justFinished = false;
  }

  if (isWorking) {
    // 일하는 중: 2초(~120프레임)마다 깜빡이며 전환
    s.blinkTimer++;

    // 깜빡임: 10프레임 꺼짐 → 110프레임 켜짐
    const cycle = s.blinkTimer % 130;
    if (cycle < 12) {
      return { type: 'work', visible: false }; // 깜빡 꺼짐
    }

    // 매 사이클마다 내용 전환
    if (cycle === 12) {
      s.showFile = !s.showFile;
      if (!s.showFile) s.workIdx = (s.workIdx + 1) % WORK_BUBBLES.length;
    }

    if (s.showFile && member.detail) {
      // 파일명 표시
      const repoTag = member.detailRepo ? `${member.detailRepo}/` : '';
      return { type: 'work', emoji: '📝', text: `${repoTag}${member.detail}`, visible: true };
    } else {
      const b = WORK_BUBBLES[s.workIdx];
      return { type: 'work', emoji: b.emoji, text: b.text, visible: true };
    }
  } else {
    // 쉬는 중: 대부분 시간 아무것도 안 보여줌
    s.idleShowTimer++;

    // 15초(~900프레임)마다 3초(~180프레임)만 아이콘 표시
    const idleCycle = s.idleShowTimer % 900;
    if (idleCycle < 180) {
      if (idleCycle === 0) {
        // 새 아이콘 선택
        s.idleIcon = IDLE_ICONS[Math.floor(Math.random() * IDLE_ICONS.length)];
      }
      // 페이드 인/아웃
      const alpha = idleCycle < 30 ? idleCycle / 30
        : idleCycle > 150 ? (180 - idleCycle) / 30
        : 1;
      return { type: 'idle', emoji: s.idleIcon, text: '', visible: true, alpha };
    }

    return { type: 'idle', visible: false };
  }
}

// ========================================
// 색상
// ========================================

const PAL = {
  bg: '#1a1830',
  wall: '#2e2848',
  wallLine: '#3d3660',
  floor1: '#25213a',
  floor2: '#2a2640',
  desk: '#6b4f24',
  deskTop: '#84612e',
  shadow: 'rgba(0,0,0,0.2)',
};

const COLORS_BY_ID = {
  artist:    { body: '#e84393', head: '#fdd8c0', hair: '#222' },
  writer:    { body: '#4a90d9', head: '#fdd8c0', hair: '#4a3020' },
  coder:     { body: '#27ae60', head: '#fdd8c0', hair: '#333' },
  designer:  { body: '#9b59b6', head: '#fdd8c0', hair: '#5a3825' },
  planner:   { body: '#e67e22', head: '#fdd8c0', hair: '#654321' },
  organizer: { body: '#1abc9c', head: '#fdd8c0', hair: '#3a2510' },
};

function getColors(id) {
  return COLORS_BY_ID[id] || { body: '#666', head: '#fdd8c0', hair: '#333' };
}

// ========================================
// 유틸
// ========================================

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); rrPath(x, y, w, h, r); ctx.fill();
}

function rrPath(x, y, w, h, r) {
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

// ========================================
// 사무실 배경
// ========================================

function drawOffice() {
  rect(0, 0, W, H, PAL.bg);
  rect(0, 0, W, 140, PAL.wall);
  rect(0, 135, W, 8, PAL.wallLine);
  for (let x = 0; x < W; x += 120) rect(x, 0, 2, 140, 'rgba(0,0,0,0.1)');
  for (let y = 143; y < H; y += 30) {
    for (let x = 0; x < W; x += 30) {
      rect(x, y, 30, 30, ((x/30|0)+(y/30|0)) % 2 === 0 ? PAL.floor1 : PAL.floor2);
    }
  }

  [50, 350, 650, 950].forEach(wx => drawWindow(wx, 12));

  // 화이트보드
  rect(195, 12, 120, 78, '#666');
  rect(199, 16, 112, 70, '#e8e8e8');
  ctx.fillStyle='#e74c3c'; ctx.fillRect(208, 28, 40, 3);
  ctx.fillStyle='#333';    ctx.fillRect(208, 38, 60, 2);
  ctx.fillStyle='#3498db'; ctx.fillRect(208, 48, 45, 2);
  ctx.fillStyle='#27ae60'; ctx.fillRect(265, 26, 28, 22);

  rect(830, 18, 28, 28, '#444');
  rect(833, 21, 22, 22, '#fff');
  const cx=844, cy=32;
  ctx.strokeStyle='#333'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(tick*0.001-Math.PI/2)*7, cy+Math.sin(tick*0.001-Math.PI/2)*7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(tick*0.02-Math.PI/2)*9, cy+Math.sin(tick*0.02-Math.PI/2)*9); ctx.stroke();

  [140, 530, 880, 1120].forEach(px => drawPlant(px, 95));

  // 커피머신
  rect(1200, 92, 28, 32, '#555');
  rect(1203, 96, 22, 14, '#333');
  rect(1209, 116, 10, 7, '#eee');
  if (tick%50<25) {
    rect(1212, 85, 2, 6, 'rgba(255,255,255,0.3)');
    rect(1216, 83, 2, 8, 'rgba(255,255,255,0.2)');
  }
}

function drawWindow(x, y) {
  rect(x, y, 80, 65, '#2c3e50');
  rect(x+4, y+4, 72, 57, '#4a8cc2');
  rect(x+39, y+4, 3, 57, '#2c3e50');
  rect(x+4, y+31, 72, 3, '#2c3e50');
  const cx = x+12+Math.sin(tick*0.005+x)*8;
  rect(cx, y+12, 16, 5, 'rgba(255,255,255,0.4)');
  rect(cx+3, y+9, 10, 4, 'rgba(255,255,255,0.3)');
}

function drawPlant(x, y) {
  rect(x+5, y-18, 3, 18, '#1e8449');
  rect(x, y-24, 14, 8, '#27ae60');
  rect(x-2, y-18, 7, 6, '#2ecc71');
  rect(x+9, y-21, 8, 7, '#27ae60');
  rect(x+1, y, 11, 8, '#8b5e3c');
  rect(x, y, 13, 2, '#9b6e4c');
}

// ========================================
// 책상
// ========================================

function drawDeskSet(x, y, isActive) {
  rect(x+4, y+20, 65, 4, PAL.shadow);
  rect(x+5, y+12, 3, 10, '#5c4420');
  rect(x+58, y+12, 3, 10, '#5c4420');
  rect(x, y+9, 66, 5, PAL.desk);
  rect(x+2, y+7, 62, 3, PAL.deskTop);

  rect(x+23, y+18, 3, 5, '#444');
  rect(x+40, y+18, 3, 5, '#444');
  rect(x+21, y+16, 24, 4, '#555');
  rect(x+22, y+9, 22, 8, '#4a4a5a');

  rect(x+21, y-8, 22, 15, '#222');
  rect(x+23, y-6, 18, 11, isActive ? '#1a2a1a' : '#0a0a0a');
  rect(x+29, y+6, 6, 2, '#333');
  rect(x+27, y+7, 10, 2, '#444');

  if (isActive) {
    const colors = ['#44bd32','#4a90d9','#f1c40f','#e74c3c'];
    for (let i=0; i<4; i++) {
      const lw = 4+(tick*2+i*9)%10;
      ctx.fillStyle=colors[i%4]; ctx.globalAlpha=0.6;
      ctx.fillRect(x+25, y-4+i*2.5, lw, 1);
    }
    ctx.globalAlpha=1;
    if (tick%25<12) rect(x+25+(tick%12), y+2, 1, 2, '#fff');
  }

  rect(x+23, y+9, 18, 3, '#444');
  rect(x+48, y+4, 5, 5, '#eee');
  rect(x+49, y+5, 3, 3, '#6f4e37');
}

// ========================================
// 캐릭터
// ========================================

function drawPerson(x, y, colors, isWorking, frame) {
  const f = frame % 120;
  const bob = isWorking && f%30<15 ? -1 : 0;

  rect(x+1, y+14, 8, 2, PAL.shadow);

  const lo = isWorking && f%16<8 ? 1 : 0;
  rect(x+2, y+12+lo, 2, 4, '#3a3a5a');
  rect(x+6, y+12+(isWorking?-lo:0), 2, 4, '#3a3a5a');

  rect(x+2, y+7, 6, 6, colors.body);
  rect(x+2, y+bob, 7, 7, colors.head);
  rect(x+2, y+bob, 7, 2, colors.hair);
  rect(x+1, y+1+bob, 1, 3, colors.hair);
  rect(x+9, y+1+bob, 1, 3, colors.hair);

  // 눈 — 쉬는 애는 가끔 감김
  if (!isWorking && f%70<4) {
    rect(x+4, y+4+bob, 1, 1, '#555');
    rect(x+7, y+4+bob, 1, 1, '#555');
  } else {
    rect(x+4, y+4+bob, 1, 1, '#333');
    rect(x+7, y+4+bob, 1, 1, '#333');
  }

  if (isWorking) {
    const ao = f%8<4 ? 0 : -1;
    rect(x, y+8+ao, 2, 3, colors.body);
    rect(x+8, y+8-ao, 2, 3, colors.body);
  } else {
    rect(x, y+8, 2, 3, colors.body);
    rect(x+8, y+8, 2, 3, colors.body);
  }
}

// ========================================
// 말풍선 — 일하는 애는 크고 화려, 쉬는 애는 작은 아이콘만
// ========================================

function drawWorkBubble(x, y, text, emoji, isTransition) {
  const hasText = text && text.length > 0;

  if (!hasText) {
    // 이모지만 — 작은 원형 버블
    const size = 36;
    const bx = x - size/2;
    const by = y - 52;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(x+2, by+size/2+2, size/2+2, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
    ctx.beginPath(); ctx.arc(x, by+size/2, size/2+2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = isTransition ? '#f39c12' : '#333';
    ctx.lineWidth = isTransition ? 3 : 2;
    ctx.beginPath(); ctx.arc(x, by+size/2, size/2+2, 0, Math.PI*2); ctx.stroke();

    // 꼬리
    ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
    ctx.beginPath();
    ctx.moveTo(x-3, by+size+1); ctx.lineTo(x+3, by+size+1); ctx.lineTo(x, by+size+7);
    ctx.fill();

    ctx.font = '22px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
    ctx.fillText(emoji, x-11, by+size/2+7);
    return;
  }

  // 텍스트 있는 버블
  ctx.font = 'bold 14px "Courier New",monospace';
  const tw = ctx.measureText(text).width;
  const totalW = Math.max(tw + 50, 120);
  const bh = 40;
  const bx = x - totalW/2;
  const by = y - 60;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(bx+4, by+4, totalW, bh, 10);

  // 배경
  ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
  roundRect(bx, by, totalW, bh, 10);

  // 테두리
  ctx.strokeStyle = isTransition ? '#f39c12' : '#333';
  ctx.lineWidth = isTransition ? 3 : 2;
  ctx.beginPath(); rrPath(bx, by, totalW, bh, 10); ctx.stroke();

  // 활동 컬러바
  ctx.save();
  ctx.beginPath(); rrPath(bx, by, 6, bh, 4); ctx.clip();
  ctx.fillStyle = isTransition ? '#f39c12' : '#2ecc71';
  ctx.fillRect(bx, by, 6, bh);
  ctx.restore();

  // 꼬리
  ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
  ctx.beginPath();
  ctx.moveTo(x-5, by+bh); ctx.lineTo(x+5, by+bh); ctx.lineTo(x, by+bh+10);
  ctx.fill();
  ctx.strokeStyle = isTransition ? '#f39c12' : '#333';
  ctx.beginPath(); ctx.moveTo(x-5, by+bh); ctx.lineTo(x, by+bh+10); ctx.lineTo(x+5, by+bh); ctx.stroke();
  ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
  ctx.fillRect(x-4, by+bh-2, 9, 3);

  // 이모지
  ctx.font = '20px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
  ctx.fillStyle = '#333';
  ctx.fillText(emoji, bx+12, by+28);

  // 텍스트
  ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillStyle = '#222';
  let display = text;
  const maxW = totalW - 54;
  while (ctx.measureText(display).width > maxW && display.length > 3) {
    display = display.slice(0, -1);
  }
  if (display !== text) display += '…';
  ctx.fillText(display, bx + 38, by + 27);
}

function drawIdleBubble(x, y, emoji, alpha) {
  // 작은 떠다니는 아이콘
  const floatY = Math.sin(tick * 0.03) * 3;
  ctx.globalAlpha = alpha;
  ctx.font = '18px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
  ctx.fillText(emoji, x - 9, y - 22 + floatY);
  ctx.globalAlpha = 1;
}

// ========================================
// 이름표
// ========================================

function drawNameBadge(x, y, name, icon, isActive) {
  ctx.font = 'bold 12px "Courier New",monospace';
  const label = `${icon} ${name}`;
  const nw = ctx.measureText(label).width + 16;
  const nx = x - nw/2;

  ctx.fillStyle = isActive ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.06)';
  roundRect(nx, y, nw, 20, 5);

  if (isActive) {
    ctx.strokeStyle = 'rgba(46,204,113,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); rrPath(nx, y, nw, 20, 5); ctx.stroke();
  }

  ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillStyle = isActive ? '#fff' : '#555';
  ctx.fillText(label, nx+8, y+14);
}

// ========================================
// 서류 날아가기
// ========================================

const papers = [];
let lastPaperTick = 0;

function maybeSpawnPaper() {
  if (tick - lastPaperTick < 400) return;
  const actives = crewData.map((m,i) => m.action==='working' ? i : -1).filter(i=>i>=0);
  if (actives.length >= 2) {
    const fi = actives[Math.floor(Math.random()*actives.length)];
    let ti = actives[Math.floor(Math.random()*actives.length)];
    if (ti===fi) ti = actives[(actives.indexOf(fi)+1)%actives.length];
    const fp = stationPos(fi), tp = stationPos(ti);
    papers.push({ x:fp.cx, y:fp.y, tx:tp.cx, ty:tp.y, t:0 });
    lastPaperTick = tick;
  }
}

function drawPapers() {
  for (let i=papers.length-1; i>=0; i--) {
    const p = papers[i];
    p.t += 0.008;
    if (p.t >= 1) { papers.splice(i,1); continue; }
    const px = p.x+(p.tx-p.x)*p.t;
    const py = p.y+(p.ty-p.y)*p.t - Math.sin(p.t*Math.PI)*120;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.t * Math.PI * 0.3);
    ctx.fillStyle = '#f5deb3';
    ctx.fillRect(-6, -8, 12, 16);
    ctx.fillStyle = '#bbb';
    ctx.fillRect(-4, -5, 8, 1);
    ctx.fillRect(-4, -2, 6, 1);
    ctx.fillRect(-4, 1, 7, 1);
    ctx.restore();
  }
}

// ========================================
// 배치
// ========================================

function stationPos(index) {
  const total = crewData.length;
  const cols = total <= 3 ? total : (total <= 6 ? 3 : 4);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const gapX = (W - 100) / cols;
  const gapY = 210;
  return {
    x: 50 + col * gapX,
    y: 195 + row * gapY,
    cx: 50 + col * gapX + 33,
  };
}

function drawStation(index, member) {
  const pos = stationPos(index);
  const bx = pos.x, by = pos.y;
  const colors = getColors(member.id);
  const isActive = member.action === 'working';

  // 활동중인 캐릭터 글로우 효과
  if (isActive) {
    const pulse = Math.sin(tick * 0.04) * 0.15 + 0.2;
    ctx.fillStyle = `rgba(46, 204, 113, ${pulse})`;
    ctx.beginPath();
    ctx.arc(pos.cx, by + 5, 45, 0, Math.PI * 2);
    ctx.fill();
  }

  drawDeskSet(bx, by, isActive);
  drawPerson(bx+27, by-4, colors, isActive, tick + index*25);
  drawNameBadge(pos.cx, by+32, member.name, member.icon, isActive);

  // 말풍선
  const bubble = getBubble(member);
  if (bubble.visible) {
    if (bubble.type === 'work' || bubble.type === 'transition') {
      drawWorkBubble(pos.cx, by-4, bubble.text, bubble.emoji, bubble.type === 'transition');
    } else if (bubble.type === 'idle') {
      drawIdleBubble(pos.cx, by-4, bubble.emoji, bubble.alpha || 1);
    }
  }
}

// ========================================
// HUD
// ========================================

function drawHUD() {
  rect(0, H-40, W, 40, 'rgba(0,0,0,0.75)');

  ctx.font = 'bold 22px "Courier New",monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('MY CREW', 20, H-12);

  const now = new Date();
  ctx.font = '14px "Courier New",monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText(now.toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit',second:'2-digit'}), W-100, H-14);

  const active = crewData.filter(c=>c.action==='working').length;

  crewData.forEach((m, i) => {
    const dx = 180 + i*32;
    const dy = H-20;
    const isAct = m.action==='working';

    if (isAct) {
      ctx.fillStyle = 'rgba(46,204,113,0.3)';
      ctx.beginPath(); ctx.arc(dx, dy, 12, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = isAct ? '#2ecc71' : '#333';
    ctx.beginPath(); ctx.arc(dx, dy, 8, 0, Math.PI*2); ctx.fill();

    ctx.font = '12px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
    ctx.fillText(m.icon, dx-6, dy+4);
  });

  const sx = 180 + crewData.length*32 + 20;
  ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillStyle = active > 0 ? '#2ecc71' : '#666';
  ctx.fillText(active > 0 ? `${active}명 활동중` : '모두 쉬는 중', sx, H-12);
}

// ========================================
// 메인
// ========================================

function render() {
  ctx.clearRect(0, 0, W, H);
  drawOffice();
  crewData.forEach((m, i) => drawStation(i, m));
  maybeSpawnPaper();
  drawPapers();
  drawHUD();
  tick++;
  requestAnimationFrame(render);
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    crewData = await res.json();
  } catch(e) {}
}

async function init() {
  await fetchStatus();
  render();
  setInterval(fetchStatus, 3000);
}

init();
