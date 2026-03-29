// ========================================
// My Crew v7 — 회의 테이블 시스템
// 2명 이상 동시 작업 → 가운데 회의 테이블로 모임
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
// 말풍선
// ========================================

const WORK_BUBBLES = [
  { emoji: '🔥', text: '' },
  { emoji: '💪', text: '' },
  { emoji: '⚡', text: '' },
  { emoji: '🧠', text: '' },
  { emoji: '🎯', text: '' },
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

const IDLE_ICONS = ['☕', '💤', '😴', '🙆', '📱'];

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
      idleShowTimer: Math.floor(Math.random() * 600), // 시작 오프셋 랜덤
      idleIcon: '',
      transitionTimer: 0,
      justStarted: false,
      justFinished: false,
    };
  }

  const s = bubbleStates[key];

  if (s.wasWorking !== isWorking) {
    if (isWorking && !s.wasWorking) {
      s.justStarted = true;
      s.justFinished = false;
      s.transitionTimer = 120;
    } else if (!isWorking && s.wasWorking) {
      s.justFinished = true;
      s.justStarted = false;
      s.transitionTimer = 150;
    }
    s.wasWorking = isWorking;
  }

  if (s.transitionTimer > 0) {
    s.transitionTimer--;
    if (s.justStarted) return { type: 'transition', emoji: '📬', text: '일감 들어왔다!', visible: true };
    if (s.justFinished) return { type: 'transition', emoji: '✅', text: '끝! 수고~', visible: true };
  } else {
    s.justStarted = false;
    s.justFinished = false;
  }

  if (isWorking) {
    s.blinkTimer++;
    const cycle = s.blinkTimer % 130;
    if (cycle < 12) return { type: 'work', visible: false };
    if (cycle === 12) {
      s.showFile = !s.showFile;
      if (!s.showFile) s.workIdx = (s.workIdx + 1) % WORK_BUBBLES.length;
    }
    if (s.showFile && member.detail) {
      const tag = member.detailRepo ? `${member.detailRepo}/` : '';
      return { type: 'work', emoji: '📝', text: `${tag}${member.detail}`, visible: true };
    } else {
      const b = WORK_BUBBLES[s.workIdx];
      return { type: 'work', emoji: b.emoji, text: b.text, visible: true };
    }
  } else {
    s.idleShowTimer++;
    const idleCycle = s.idleShowTimer % 900;
    if (idleCycle < 180) {
      if (idleCycle === 0) s.idleIcon = IDLE_ICONS[Math.floor(Math.random() * IDLE_ICONS.length)];
      const alpha = idleCycle < 30 ? idleCycle/30 : idleCycle > 150 ? (180-idleCycle)/30 : 1;
      return { type: 'idle', emoji: s.idleIcon, visible: true, alpha };
    }
    return { type: 'idle', visible: false };
  }
}

// ========================================
// 캐릭터 위치 애니메이션 (자리 ↔ 회의 테이블)
// ========================================

const charPositions = {}; // { id: { x, y, targetX, targetY } }

function lerp(a, b, t) {
  return a + (b - a) * Math.min(t, 1);
}

function updateCharPosition(id, targetX, targetY) {
  if (!charPositions[id]) {
    charPositions[id] = { x: targetX, y: targetY, targetX, targetY };
  }
  const p = charPositions[id];
  p.targetX = targetX;
  p.targetY = targetY;
  // 부드럽게 이동
  p.x = lerp(p.x, p.targetX, 0.04);
  p.y = lerp(p.y, p.targetY, 0.04);
  return { x: p.x, y: p.y };
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
  meetingTable: '#5a4020',
  meetingTableTop: '#7a5830',
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
  rect(0, 0, W, 120, PAL.wall);
  rect(0, 116, W, 6, PAL.wallLine);

  for (let x = 0; x < W; x += 120) rect(x, 0, 2, 120, 'rgba(0,0,0,0.1)');

  for (let y = 122; y < H; y += 28) {
    for (let x = 0; x < W; x += 28) {
      rect(x, y, 28, 28, ((x/28|0)+(y/28|0)) % 2 === 0 ? PAL.floor1 : PAL.floor2);
    }
  }

  // 창문
  [30, 280, 730, 980].forEach(wx => drawWindow(wx, 8));

  // 화이트보드
  rect(500, 8, 100, 68, '#666');
  rect(503, 11, 94, 62, '#e8e8e8');
  ctx.fillStyle='#e74c3c'; ctx.fillRect(512, 22, 35, 3);
  ctx.fillStyle='#333';    ctx.fillRect(512, 30, 50, 2);
  ctx.fillStyle='#3498db'; ctx.fillRect(512, 38, 38, 2);
  ctx.fillStyle='#27ae60'; ctx.fillRect(555, 20, 24, 18);

  // 시계
  rect(660, 14, 24, 24, '#444');
  rect(662, 16, 20, 20, '#fff');
  const cx=672, cy=26;
  ctx.strokeStyle='#333'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(tick*0.001-Math.PI/2)*6, cy+Math.sin(tick*0.001-Math.PI/2)*6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(tick*0.02-Math.PI/2)*8, cy+Math.sin(tick*0.02-Math.PI/2)*8); ctx.stroke();

  // 화분
  [170, 450, 720, 1050].forEach(px => drawPlant(px, 82));

  // 커피머신
  rect(1210, 78, 24, 28, '#555');
  rect(1213, 82, 18, 12, '#333');
  rect(1218, 100, 8, 5, '#eee');
  if (tick%50<25) {
    rect(1221, 72, 1, 5, 'rgba(255,255,255,0.3)');
    rect(1224, 70, 1, 7, 'rgba(255,255,255,0.2)');
  }
}

function drawWindow(x, y) {
  rect(x, y, 70, 58, '#2c3e50');
  rect(x+3, y+3, 64, 52, '#4a8cc2');
  rect(x+34, y+3, 2, 52, '#2c3e50');
  rect(x+3, y+28, 64, 2, '#2c3e50');
  const cx = x+10+Math.sin(tick*0.005+x)*7;
  rect(cx, y+10, 14, 4, 'rgba(255,255,255,0.4)');
  rect(cx+3, y+7, 8, 3, 'rgba(255,255,255,0.3)');
}

function drawPlant(x, y) {
  rect(x+4, y-15, 2, 15, '#1e8449');
  rect(x, y-20, 11, 7, '#27ae60');
  rect(x-2, y-15, 6, 5, '#2ecc71');
  rect(x+7, y-18, 7, 6, '#27ae60');
  rect(x+1, y, 9, 7, '#8b5e3c');
  rect(x, y, 11, 2, '#9b6e4c');
}

// ========================================
// 회의 테이블 (가운데)
// ========================================

const TABLE_CX = W / 2;
const TABLE_CY = 340;

function drawMeetingTable(activeCount) {
  if (activeCount < 2) return; // 2명 이상일 때만

  const tw = 160;
  const th = 80;
  const tx = TABLE_CX - tw/2;
  const ty = TABLE_CY - th/2;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  roundRect(tx+5, ty+5, tw, th, 12);

  // 테이블 다리
  rect(tx+15, ty+th-5, 5, 15, '#4a3018');
  rect(tx+tw-20, ty+th-5, 5, 15, '#4a3018');

  // 테이블 상판
  ctx.fillStyle = PAL.meetingTable;
  roundRect(tx, ty, tw, th, 12);
  ctx.fillStyle = PAL.meetingTableTop;
  roundRect(tx+4, ty+4, tw-8, th-8, 8);

  // 테이블 위 장식
  // 노트북
  rect(tx+30, ty+15, 20, 14, '#333');
  rect(tx+31, ty+16, 18, 10, '#1a3a1a');
  // 서류
  rect(tx+70, ty+18, 14, 18, '#f5f5f5');
  rect(tx+72, ty+20, 10, 1, '#ccc');
  rect(tx+72, ty+23, 8, 1, '#ccc');
  rect(tx+72, ty+26, 9, 1, '#ccc');
  // 펜
  rect(tx+90, ty+22, 12, 2, '#e74c3c');
  // 머그컵
  rect(tx+110, ty+25, 6, 6, '#eee');
  rect(tx+111, ty+26, 4, 4, '#6f4e37');

  // "회의중" 표시
  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('— 회의중 —', TABLE_CX - 30, TABLE_CY + th/2 + 18);
}

// 회의 테이블 주변 좌석 위치 (최대 6명)
function getMeetingSeat(seatIndex, totalSeats) {
  const angleOffset = -Math.PI / 2; // 12시 방향 시작
  const radiusX = 120;
  const radiusY = 65;

  const angle = angleOffset + (seatIndex / totalSeats) * Math.PI * 2;
  return {
    x: TABLE_CX + Math.cos(angle) * radiusX - 5,
    y: TABLE_CY + Math.sin(angle) * radiusY - 8,
  };
}

// ========================================
// 개인 책상 (작게, 양옆에 배치)
// ========================================

function deskPos(index, total) {
  // 왼쪽 3개, 오른쪽 3개
  const leftCount = Math.ceil(total / 2);
  const isLeft = index < leftCount;
  const localIdx = isLeft ? index : index - leftCount;
  const colCount = isLeft ? leftCount : total - leftCount;

  const gapY = 130;
  const startY = 165;

  if (isLeft) {
    return { x: 40, y: startY + localIdx * gapY, cx: 40 + 33 };
  } else {
    return { x: W - 115, y: startY + localIdx * gapY, cx: W - 115 + 33 };
  }
}

function drawSmallDesk(x, y, isActive) {
  rect(x+3, y+18, 55, 3, PAL.shadow);
  rect(x+4, y+10, 3, 10, '#5c4420');
  rect(x+50, y+10, 3, 10, '#5c4420');
  rect(x, y+8, 57, 4, PAL.desk);
  rect(x+2, y+6, 53, 3, PAL.deskTop);

  // 의자
  rect(x+19, y+15, 3, 4, '#444');
  rect(x+35, y+15, 3, 4, '#444');
  rect(x+17, y+13, 23, 3, '#555');
  rect(x+18, y+7, 21, 7, '#4a4a5a');

  // 모니터
  rect(x+17, y-7, 20, 13, '#222');
  rect(x+19, y-5, 16, 9, isActive ? '#1a2a1a' : '#0a0a0a');
  rect(x+24, y+5, 5, 2, '#333');
  rect(x+22, y+6, 9, 2, '#444');

  if (isActive) {
    for (let i=0; i<3; i++) {
      const lw = 3+(tick*2+i*7)%8;
      ctx.fillStyle=['#44bd32','#4a90d9','#f1c40f'][i]; ctx.globalAlpha=0.5;
      ctx.fillRect(x+21, y-3+i*2.5, lw, 1);
    }
    ctx.globalAlpha=1;
  }

  rect(x+19, y+8, 16, 2, '#444');
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

// 걸어가는 캐릭터 (이동중)
function drawWalkingPerson(x, y, colors, frame) {
  const f = frame % 120;
  const bounce = Math.abs(Math.sin(f * 0.2)) * 2;

  rect(x+1, y+14, 8, 2, PAL.shadow);

  const leg = f%8<4 ? 2 : -2;
  rect(x+2+leg, y+12-bounce, 2, 4, '#3a3a5a');
  rect(x+6-leg, y+12-bounce, 2, 4, '#3a3a5a');

  rect(x+2, y+7-bounce, 6, 6, colors.body);
  rect(x+2, y-bounce, 7, 7, colors.head);
  rect(x+2, y-bounce, 7, 2, colors.hair);
  rect(x+1, y+1-bounce, 1, 3, colors.hair);
  rect(x+9, y+1-bounce, 1, 3, colors.hair);

  rect(x+4, y+4-bounce, 1, 1, '#333');
  rect(x+7, y+4-bounce, 1, 1, '#333');

  // 팔 흔들기
  const armSwing = Math.sin(f * 0.2) * 2;
  rect(x, y+7-bounce+armSwing, 2, 3, colors.body);
  rect(x+8, y+7-bounce-armSwing, 2, 3, colors.body);
}

// ========================================
// 말풍선
// ========================================

function drawWorkBubble(x, y, text, emoji, isTransition) {
  const hasText = text && text.length > 0;

  if (!hasText) {
    const size = 34;
    const bx = x - size/2;
    const by = y - 50;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(x+2, by+size/2+2, size/2+2, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
    ctx.beginPath(); ctx.arc(x, by+size/2, size/2+2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = isTransition ? '#f39c12' : '#333';
    ctx.lineWidth = isTransition ? 3 : 2;
    ctx.beginPath(); ctx.arc(x, by+size/2, size/2+2, 0, Math.PI*2); ctx.stroke();

    ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
    ctx.beginPath();
    ctx.moveTo(x-3, by+size+1); ctx.lineTo(x+3, by+size+1); ctx.lineTo(x, by+size+6);
    ctx.fill();

    ctx.font = '20px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
    ctx.fillText(emoji, x-10, by+size/2+7);
    return;
  }

  ctx.font = 'bold 14px "Courier New",monospace';
  const tw = ctx.measureText(text).width;
  const totalW = Math.max(tw + 50, 110);
  const bh = 38;
  const bx = x - totalW/2;
  const by = y - 58;

  // 화면 밖으로 나가지 않게
  const clampedBx = Math.max(5, Math.min(bx, W - totalW - 5));

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(clampedBx+4, by+4, totalW, bh, 10);

  ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
  roundRect(clampedBx, by, totalW, bh, 10);

  ctx.strokeStyle = isTransition ? '#f39c12' : '#333';
  ctx.lineWidth = isTransition ? 3 : 2;
  ctx.beginPath(); rrPath(clampedBx, by, totalW, bh, 10); ctx.stroke();

  ctx.save();
  ctx.beginPath(); rrPath(clampedBx, by, 6, bh, 4); ctx.clip();
  ctx.fillStyle = isTransition ? '#f39c12' : '#2ecc71';
  ctx.fillRect(clampedBx, by, 6, bh);
  ctx.restore();

  // 꼬리
  const tailX = Math.max(clampedBx + 15, Math.min(x, clampedBx + totalW - 15));
  ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
  ctx.beginPath();
  ctx.moveTo(tailX-5, by+bh); ctx.lineTo(tailX+5, by+bh); ctx.lineTo(tailX, by+bh+8);
  ctx.fill();
  ctx.strokeStyle = isTransition ? '#f39c12' : '#333';
  ctx.beginPath(); ctx.moveTo(tailX-5, by+bh); ctx.lineTo(tailX, by+bh+8); ctx.lineTo(tailX+5, by+bh); ctx.stroke();
  ctx.fillStyle = isTransition ? '#fff9c4' : '#fff';
  ctx.fillRect(tailX-4, by+bh-2, 9, 3);

  ctx.font = '20px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
  ctx.fillStyle = '#333';
  ctx.fillText(emoji, clampedBx+12, by+27);

  ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillStyle = '#222';
  let display = text;
  const maxW = totalW - 50;
  while (ctx.measureText(display).width > maxW && display.length > 3) display = display.slice(0,-1);
  if (display !== text) display += '…';
  ctx.fillText(display, clampedBx+38, by+26);
}

function drawIdleBubble(x, y, emoji, alpha) {
  const floatY = Math.sin(tick * 0.03) * 3;
  ctx.globalAlpha = alpha;
  ctx.font = '16px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
  ctx.fillText(emoji, x-8, y-20+floatY);
  ctx.globalAlpha = 1;
}

// ========================================
// 이름표
// ========================================

function drawNameBadge(x, y, name, icon, isActive) {
  ctx.font = 'bold 11px "Courier New",monospace';
  const label = `${icon} ${name}`;
  const nw = ctx.measureText(label).width + 14;
  const nx = x - nw/2;

  ctx.fillStyle = isActive ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.06)';
  roundRect(nx, y, nw, 18, 4);

  if (isActive) {
    ctx.strokeStyle = 'rgba(46,204,113,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); rrPath(nx, y, nw, 18, 4); ctx.stroke();
  }

  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = isActive ? '#fff' : '#555';
  ctx.fillText(label, nx+7, y+13);
}

// ========================================
// 서류 날아가기
// ========================================

const papers = [];
let lastPaperTick = 0;

function maybeSpawnPaper() {
  if (tick - lastPaperTick < 350) return;
  const actives = crewData.filter(m => m.action === 'working');
  if (actives.length >= 2) {
    // 회의 테이블 멤버끼리 서류 교환
    const fi = Math.floor(Math.random() * actives.length);
    let ti = Math.floor(Math.random() * actives.length);
    if (ti === fi) ti = (fi + 1) % actives.length;
    const fp = getMeetingSeat(fi, actives.length);
    const tp = getMeetingSeat(ti, actives.length);
    papers.push({ x: fp.x+5, y: fp.y, tx: tp.x+5, ty: tp.y, t: 0 });
    lastPaperTick = tick;
  }
}

function drawPapers() {
  for (let i=papers.length-1; i>=0; i--) {
    const p = papers[i];
    p.t += 0.01;
    if (p.t >= 1) { papers.splice(i,1); continue; }
    const px = p.x+(p.tx-p.x)*p.t;
    const py = p.y+(p.ty-p.y)*p.t - Math.sin(p.t*Math.PI)*60;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.t * Math.PI * 0.3);
    ctx.fillStyle = '#f5deb3';
    ctx.fillRect(-5, -7, 10, 14);
    ctx.fillStyle = '#bbb';
    ctx.fillRect(-3, -4, 6, 1);
    ctx.fillRect(-3, -1, 5, 1);
    ctx.fillRect(-3, 2, 6, 1);
    ctx.restore();
  }
}

// ========================================
// 메인 렌더
// ========================================

function render() {
  ctx.clearRect(0, 0, W, H);

  drawOffice();

  const activeMembers = crewData.filter(m => m.action === 'working');
  const idleMembers = crewData.filter(m => m.action !== 'working');
  const isMeeting = activeMembers.length >= 2;

  // 회의 테이블 (2명 이상 활동시)
  drawMeetingTable(activeMembers.length);

  // 개인 책상 그리기 (전원)
  crewData.forEach((member, i) => {
    const dp = deskPos(i, crewData.length);
    const isActive = member.action === 'working';
    drawSmallDesk(dp.x, dp.y, false); // 빈 책상 (모니터 꺼짐)
  });

  // 쉬는 멤버 — 자기 자리에
  crewData.forEach((member, globalIdx) => {
    if (member.action === 'working') return;

    const dp = deskPos(globalIdx, crewData.length);
    const colors = getColors(member.id);
    const pos = updateCharPosition(member.id, dp.x + 23, dp.y - 4);

    // 이동중인지 체크 (위치 차이)
    const dist = Math.abs(pos.x - dp.x - 23) + Math.abs(pos.y - dp.y + 4);
    if (dist > 5) {
      drawWalkingPerson(pos.x, pos.y, colors, tick);
    } else {
      drawPerson(pos.x, pos.y, colors, false, tick + globalIdx * 25);
    }

    drawNameBadge(dp.cx, dp.y + 28, member.name, member.icon, false);

    const bubble = getBubble(member);
    if (bubble.visible) {
      if (bubble.type === 'transition') {
        drawWorkBubble(dp.cx, dp.y - 4, bubble.text, bubble.emoji, true);
      } else {
        drawIdleBubble(dp.cx, dp.y - 4, bubble.emoji, bubble.alpha || 1);
      }
    }
  });

  // 일하는 멤버
  if (isMeeting) {
    // 회의 테이블로!
    activeMembers.forEach((member, seatIdx) => {
      const seat = getMeetingSeat(seatIdx, activeMembers.length);
      const colors = getColors(member.id);
      const pos = updateCharPosition(member.id, seat.x, seat.y);

      const dist = Math.abs(pos.x - seat.x) + Math.abs(pos.y - seat.y);
      if (dist > 5) {
        drawWalkingPerson(pos.x, pos.y, colors, tick);
      } else {
        drawPerson(pos.x, pos.y, colors, true, tick + seatIdx * 25);
      }

      drawNameBadge(pos.x + 5, pos.y + 22, member.name, member.icon, true);

      const bubble = getBubble(member);
      if (bubble.visible) {
        drawWorkBubble(pos.x + 5, pos.y, bubble.text, bubble.emoji, bubble.type === 'transition');
      }
    });
  } else if (activeMembers.length === 1) {
    // 혼자 일하면 자기 자리에서
    const member = activeMembers[0];
    const globalIdx = crewData.indexOf(member);
    const dp = deskPos(globalIdx, crewData.length);
    const colors = getColors(member.id);
    const pos = updateCharPosition(member.id, dp.x + 23, dp.y - 4);

    const dist = Math.abs(pos.x - dp.x - 23) + Math.abs(pos.y - dp.y + 4);
    if (dist > 5) {
      drawWalkingPerson(pos.x, pos.y, colors, tick);
    } else {
      drawPerson(pos.x, pos.y, colors, true, tick + globalIdx * 25);
    }

    // 책상 모니터 켜기
    drawSmallDesk(dp.x, dp.y, true);

    drawNameBadge(dp.cx, dp.y + 28, member.name, member.icon, true);

    const bubble = getBubble(member);
    if (bubble.visible) {
      drawWorkBubble(dp.cx, dp.y - 4, bubble.text, bubble.emoji, bubble.type === 'transition');
    }
  }

  maybeSpawnPaper();
  drawPapers();
  drawHUD();

  tick++;
  requestAnimationFrame(render);
}

// ========================================
// HUD
// ========================================

function drawHUD() {
  rect(0, H-38, W, 38, 'rgba(0,0,0,0.75)');

  ctx.font = 'bold 20px "Courier New",monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('MY CREW', 20, H-12);

  const now = new Date();
  ctx.font = '13px "Courier New",monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText(now.toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit',second:'2-digit'}), W-95, H-14);

  const active = crewData.filter(c => c.action === 'working').length;

  crewData.forEach((m, i) => {
    const dx = 170 + i*30;
    const dy = H-19;
    const isAct = m.action === 'working';

    if (isAct) {
      ctx.fillStyle = 'rgba(46,204,113,0.3)';
      ctx.beginPath(); ctx.arc(dx, dy, 11, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = isAct ? '#2ecc71' : '#333';
    ctx.beginPath(); ctx.arc(dx, dy, 7, 0, Math.PI*2); ctx.fill();

    ctx.font = '11px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
    ctx.fillText(m.icon, dx-5, dy+4);
  });

  const sx = 170 + crewData.length*30 + 15;
  ctx.font = 'bold 13px "Courier New",monospace';
  if (active >= 2) {
    ctx.fillStyle = '#2ecc71';
    ctx.fillText(`${active}명 회의중 🗣️`, sx, H-12);
  } else if (active === 1) {
    ctx.fillStyle = '#2ecc71';
    ctx.fillText('1명 활동중', sx, H-12);
  } else {
    ctx.fillStyle = '#666';
    ctx.fillText('모두 쉬는 중', sx, H-12);
  }
}

// ========================================
// 초기화
// ========================================

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
