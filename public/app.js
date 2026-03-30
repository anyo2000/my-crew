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
  artist:    { body: '#e84393', bodyDark: '#c0357a', shirt: '#fff', head: '#fdd8c0', headShadow: '#ecc4a8', hair: '#222', hairHi: '#444', eye: '#333', cheek: '#f0a0a0' },
  writer:    { body: '#4a90d9', bodyDark: '#3a78b8', shirt: '#e8e8f0', head: '#fdd8c0', headShadow: '#ecc4a8', hair: '#4a3020', hairHi: '#6a4a38', eye: '#333', cheek: '#f0a0a0' },
  coder:     { body: '#27ae60', bodyDark: '#1e8a4c', shirt: '#1a1a2e', head: '#fdd8c0', headShadow: '#ecc4a8', hair: '#333', hairHi: '#555', eye: '#333', cheek: '#f0a0a0' },
  designer:  { body: '#9b59b6', bodyDark: '#7d4596', shirt: '#fff', head: '#fdd8c0', headShadow: '#ecc4a8', hair: '#5a3825', hairHi: '#7a5840', eye: '#333', cheek: '#f0a0a0' },
  planner:   { body: '#e67e22', bodyDark: '#c56a1a', shirt: '#fff8ee', head: '#fdd8c0', headShadow: '#ecc4a8', hair: '#654321', hairHi: '#856340', eye: '#333', cheek: '#f0a0a0' },
  publisher: { body: '#e74c3c', bodyDark: '#c0392b', shirt: '#fff', head: '#fdd8c0', headShadow: '#ecc4a8', hair: '#1a1a2e', hairHi: '#3a3a4e', eye: '#333', cheek: '#f0a0a0' },
  organizer: { body: '#1abc9c', bodyDark: '#15997e', shirt: '#e0f5f0', head: '#fdd8c0', headShadow: '#ecc4a8', hair: '#3a2510', hairHi: '#5a4530', eye: '#333', cheek: '#f0a0a0' },
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

  // === 왼쪽 사무실 소품 ===

  // 책장 (왼쪽 벽)
  rect(30, 140, 80, 120, '#4a3520');
  rect(33, 143, 74, 2, '#6b5030');
  rect(33, 175, 74, 2, '#6b5030');
  rect(33, 207, 74, 2, '#6b5030');
  rect(33, 239, 74, 2, '#6b5030');
  // 책들
  rect(38, 148, 8, 25, '#e74c3c');
  rect(48, 152, 6, 21, '#3498db');
  rect(56, 149, 7, 24, '#f39c12');
  rect(65, 151, 9, 22, '#2ecc71');
  rect(77, 148, 6, 25, '#9b59b6');
  rect(85, 153, 8, 20, '#1abc9c');
  rect(38, 180, 10, 25, '#e67e22');
  rect(50, 183, 7, 22, '#2980b9');
  rect(60, 179, 8, 26, '#c0392b');
  rect(72, 182, 6, 23, '#8e44ad');
  rect(82, 180, 10, 25, '#16a085');
  rect(40, 212, 12, 24, '#d35400');
  rect(55, 214, 8, 22, '#27ae60');
  rect(66, 211, 9, 25, '#2c3e50');
  rect(80, 213, 7, 23, '#e74c3c');

  // 서류함 (왼쪽 아래)
  rect(50, 380, 70, 90, '#555');
  rect(53, 385, 64, 18, '#666');
  rect(53, 408, 64, 18, '#666');
  rect(53, 431, 64, 18, '#666');
  rect(80, 391, 12, 6, '#888');
  rect(80, 414, 12, 6, '#888');
  rect(80, 437, 12, 6, '#888');

  // 워터쿨러 (왼쪽)
  rect(140, 320, 30, 50, '#bbb');
  rect(143, 310, 24, 14, '#89CFF0');
  rect(143, 306, 24, 6, '#aaa');
  rect(150, 365, 10, 5, '#999');

  // === 오른쪽 사무실 소품 ===

  // 프린터 (오른쪽)
  rect(1100, 330, 50, 30, '#666');
  rect(1103, 325, 44, 8, '#777');
  rect(1110, 355, 30, 3, '#eee');

  // 게시판 (오른쪽 벽)
  rect(1120, 140, 100, 80, '#8b6f47');
  rect(1123, 143, 94, 74, '#d4a853');
  // 메모들
  rect(1130, 150, 25, 25, '#fff3b0');
  rect(1160, 148, 25, 28, '#ffb3b3');
  rect(1190, 152, 25, 22, '#b3d9ff');
  rect(1135, 182, 22, 22, '#c8f7c5');
  rect(1162, 180, 28, 25, '#e8d5f5');

  // 우산꽂이 (오른쪽 아래)
  rect(1180, 400, 30, 40, '#555');
  rect(1185, 385, 3, 20, '#e74c3c');
  rect(1192, 388, 3, 17, '#3498db');
  rect(1199, 386, 3, 19, '#f1c40f');
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

  const tw = 220;
  const th = 110;
  const tx = TABLE_CX - tw/2;
  const ty = TABLE_CY - th/2;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  roundRect(tx+6, ty+6, tw, th, 14);

  // 테이블 다리
  rect(tx+20, ty+th-5, 6, 18, '#4a3018');
  rect(tx+tw-26, ty+th-5, 6, 18, '#4a3018');

  // 테이블 상판
  ctx.fillStyle = PAL.meetingTable;
  roundRect(tx, ty, tw, th, 14);
  ctx.fillStyle = PAL.meetingTableTop;
  roundRect(tx+5, ty+5, tw-10, th-10, 10);

  // 테이블 위 장식
  // 노트북
  rect(tx+35, ty+20, 28, 20, '#333');
  rect(tx+37, ty+22, 24, 14, '#1a3a1a');
  // 서류
  rect(tx+85, ty+22, 20, 24, '#f5f5f5');
  rect(tx+88, ty+26, 14, 2, '#ccc');
  rect(tx+88, ty+31, 10, 2, '#ccc');
  rect(tx+88, ty+36, 12, 2, '#ccc');
  // 펜
  rect(tx+115, ty+30, 16, 3, '#e74c3c');
  // 머그컵
  rect(tx+150, ty+32, 8, 8, '#eee');
  rect(tx+151, ty+33, 6, 6, '#6f4e37');
  rect(tx+158, ty+34, 3, 4, '#ddd');
  // 물병
  rect(tx+175, ty+25, 6, 14, '#89CFF0');
  rect(tx+174, ty+23, 8, 4, '#aaa');

  // "회의중" 표시
  ctx.font = 'bold 13px "Courier New",monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('— 회의중 —', TABLE_CX - 36, TABLE_CY + th/2 + 22);
}

// 회의 테이블 주변 좌석 위치 (최대 7명)
function getMeetingSeat(seatIndex, totalSeats) {
  const angleOffset = -Math.PI / 2; // 12시 방향 시작
  const radiusX = 165;
  const radiusY = 100;

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
  // 왼쪽 3개, 오른쪽 3개 — 가운데 모임
  const leftCount = Math.ceil(total / 2);
  const isLeft = index < leftCount;
  const localIdx = isLeft ? index : index - leftCount;

  const gapY = total <= 6 ? 130 : 115;
  const startY = total <= 6 ? 165 : 150;
  const leftX = 250;
  const rightX = W - 325;

  if (isLeft) {
    return { x: leftX, y: startY + localIdx * gapY, cx: leftX + 38 };
  } else {
    return { x: rightX, y: startY + localIdx * gapY, cx: rightX + 38 };
  }
}

function drawSmallDesk(x, y, isActive) {
  const dw = 75, dh = 6;

  // 그림자
  rect(x+3, y+dh+14, dw, 3, PAL.shadow);
  // 다리
  rect(x+5, y+dh+4, 4, 12, '#5c4420');
  rect(x+dw-9, y+dh+4, 4, 12, '#5c4420');
  // 상판
  rect(x, y+dh, dw, 5, PAL.desk);
  rect(x+2, y+dh-2, dw-4, 3, PAL.deskTop);

  // 의자
  rect(x+25, y+dh+10, 4, 5, '#444');
  rect(x+46, y+dh+10, 4, 5, '#444');
  rect(x+23, y+dh+8, 30, 3, '#555');
  rect(x+24, y+dh+2, 28, 7, '#4a4a5a');

  // 모니터
  rect(x+22, y-10, 28, 17, '#222');
  rect(x+24, y-8, 24, 13, isActive ? '#1a2a1a' : '#0a0a0a');
  rect(x+32, y+6, 8, 3, '#333');
  rect(x+29, y+8, 14, 2, '#444');

  if (isActive) {
    for (let i=0; i<4; i++) {
      const lw = 5+(tick*2+i*7)%12;
      ctx.fillStyle=['#44bd32','#4a90d9','#f1c40f','#e74c3c'][i]; ctx.globalAlpha=0.5;
      ctx.fillRect(x+26, y-6+i*3, lw, 2);
    }
    ctx.globalAlpha=1;
  }

  // 키보드
  rect(x+28, y+dh-5, 18, 3, '#333');
  rect(x+29, y+dh-4, 16, 1, '#555');

  // 머그컵
  rect(x+55, y+dh-6, 6, 6, '#eee');
  rect(x+56, y+dh-5, 4, 4, '#6f4e37');
  rect(x+61, y+dh-4, 2, 3, '#ddd');
}

// ========================================
// 캐릭터
// ========================================

// 캐릭터 크기 상수
const CH = { headW: 20, headH: 20, bodyW: 18, bodyH: 16, legH: 10, armW: 5, totalH: 46 };

function drawPersonHead(x, y, colors, id, frame, isWorking) {
  const f = frame % 120;

  // 머리 베이스
  rect(x, y, CH.headW, CH.headH, colors.head);
  rect(x+1, y+1, CH.headW-2, CH.headH-2, colors.head);
  // 얼굴 그림자 (턱 라인)
  rect(x+2, y+CH.headH-4, CH.headW-4, 3, colors.headShadow);

  // 머리카락 (역할별 스타일)
  if (id === 'artist') {
    // 짧은 단발 + 앞머리
    rect(x-1, y-2, CH.headW+2, 7, colors.hair);
    rect(x-2, y+2, 3, 10, colors.hair);
    rect(x+CH.headW-1, y+2, 3, 10, colors.hair);
    rect(x+2, y+1, 5, 3, colors.hairHi); // 하이라이트
  } else if (id === 'writer') {
    // 깔끔한 옆가르마
    rect(x, y-2, CH.headW, 6, colors.hair);
    rect(x-1, y+1, 3, 8, colors.hair);
    rect(x+CH.headW-2, y+1, 3, 6, colors.hair);
    rect(x+3, y, 4, 2, colors.hairHi);
  } else if (id === 'coder') {
    // 헝클어진 머리
    rect(x-1, y-3, CH.headW+2, 7, colors.hair);
    rect(x-2, y+1, 3, 7, colors.hair);
    rect(x+CH.headW-1, y+1, 3, 7, colors.hair);
    rect(x+3, y-4, 3, 3, colors.hair);
    rect(x+12, y-3, 4, 2, colors.hair);
    rect(x+7, y-1, 3, 2, colors.hairHi);
  } else if (id === 'designer') {
    // 올림머리 / 묶음
    rect(x, y-2, CH.headW, 6, colors.hair);
    rect(x-1, y+1, 3, 8, colors.hair);
    rect(x+CH.headW-2, y+1, 3, 6, colors.hair);
    rect(x+6, y-5, 8, 5, colors.hair); // 묶음 볼륨
    rect(x+8, y-4, 4, 2, colors.hairHi);
  } else if (id === 'planner') {
    // 빡빡이에 가까운 짧은 머리
    rect(x+1, y-1, CH.headW-2, 5, colors.hair);
    rect(x, y+1, 2, 4, colors.hair);
    rect(x+CH.headW-2, y+1, 2, 4, colors.hair);
    rect(x+5, y, 3, 2, colors.hairHi);
  } else if (id === 'publisher') {
    // 짧은 투블럭
    rect(x, y-2, CH.headW, 6, colors.hair);
    rect(x-1, y+1, 3, 5, colors.hair);
    rect(x+CH.headW-2, y+1, 3, 5, colors.hair);
    rect(x+5, y-1, 8, 3, colors.hairHi);
  } else {
    // organizer — 단정한 올백
    rect(x, y-2, CH.headW, 6, colors.hair);
    rect(x-1, y+1, 3, 9, colors.hair);
    rect(x+CH.headW-2, y+1, 3, 7, colors.hair);
    rect(x+4, y, 5, 2, colors.hairHi);
  }

  // 눈 (3x3 흰자 + 2x2 눈동자)
  const blink = !isWorking && f%70 < 3;
  const eyeY = y + 8;
  const lEyeX = x + 5;
  const rEyeX = x + 12;

  if (blink) {
    rect(lEyeX, eyeY+1, 4, 1, colors.eye);
    rect(rEyeX, eyeY+1, 4, 1, colors.eye);
  } else {
    // 흰자
    rect(lEyeX, eyeY, 4, 4, '#fff');
    rect(rEyeX, eyeY, 4, 4, '#fff');
    // 눈동자
    const lookX = isWorking ? 1 : 0;
    rect(lEyeX+1+lookX, eyeY+1, 2, 2, colors.eye);
    rect(rEyeX+1+lookX, eyeY+1, 2, 2, colors.eye);
    // 하이라이트
    rect(lEyeX+1+lookX, eyeY+1, 1, 1, '#fff');
    rect(rEyeX+1+lookX, eyeY+1, 1, 1, '#fff');
  }

  // 눈썹
  if (isWorking) {
    // 집중 눈썹 (살짝 찡그림)
    rect(lEyeX, eyeY-2, 4, 1, colors.hair);
    rect(rEyeX, eyeY-2, 4, 1, colors.hair);
  } else {
    rect(lEyeX-1, eyeY-2, 4, 1, colors.hair);
    rect(rEyeX+1, eyeY-2, 4, 1, colors.hair);
  }

  // 볼터치
  rect(x+2, y+12, 3, 2, colors.cheek);
  rect(x+CH.headW-5, y+12, 3, 2, colors.cheek);

  // 입
  if (isWorking) {
    rect(x+8, y+14, 4, 1, '#c0846a'); // 다문 입
  } else if (f%200 < 30) {
    rect(x+8, y+14, 4, 2, '#c0846a'); // 살짝 벌린 입
    rect(x+9, y+15, 2, 1, '#a06050');
  } else {
    rect(x+8, y+14, 4, 1, '#c0846a');
  }
}

function drawPersonBody(x, y, colors, id, isWorking, frame) {
  const f = frame % 120;
  const bx = x + (CH.headW - CH.bodyW) / 2; // 몸 중앙 정렬

  // 몸통
  rect(bx, y, CH.bodyW, CH.bodyH, colors.body);
  rect(bx+1, y+1, CH.bodyW-2, CH.bodyH-2, colors.body);
  // 옷 디테일
  rect(bx+CH.bodyW/2-1, y+2, 2, CH.bodyH-4, colors.bodyDark); // 가운데 라인
  // 칼라
  rect(bx+4, y, 4, 3, colors.shirt);
  rect(bx+CH.bodyW-8, y, 4, 3, colors.shirt);

  // 역할별 소품
  if (id === 'artist') {
    // 앞치마 느낌 줄무늬
    rect(bx+3, y+8, CH.bodyW-6, 2, colors.bodyDark);
  } else if (id === 'coder') {
    // 후드 끈
    rect(bx+6, y+1, 2, 5, '#ccc');
    rect(bx+CH.bodyW-8, y+1, 2, 5, '#ccc');
  } else if (id === 'planner') {
    // 넥타이
    rect(bx+CH.bodyW/2-1, y+2, 2, 8, '#c0392b');
    rect(bx+CH.bodyW/2-2, y+9, 4, 3, '#c0392b');
  }
}

function drawPerson(x, y, colors, isWorking, frame, id) {
  const f = frame % 120;
  const bob = isWorking && f%30<15 ? -1 : 0;
  id = id || 'coder';

  // 그림자
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath();
  ctx.ellipse(x + CH.headW/2, y + CH.totalH + 2, CH.headW/2 + 2, 3, 0, 0, Math.PI*2);
  ctx.fill();

  // 다리
  const legX = x + (CH.headW - CH.bodyW) / 2;
  const legY = y + CH.headH + CH.bodyH + bob;
  const lo = isWorking && f%16<8 ? 2 : 0;
  rect(legX+3, legY+lo, 5, CH.legH-lo, '#3a3a5a');
  rect(legX+CH.bodyW-8, legY+(isWorking?-lo:0), 5, CH.legH+(isWorking?lo:0), '#3a3a5a');
  // 신발
  rect(legX+2, legY+CH.legH-2, 7, 3, '#2a2a3a');
  rect(legX+CH.bodyW-9, legY+CH.legH-2, 7, 3, '#2a2a3a');

  // 몸
  drawPersonBody(x, y + CH.headH + bob, colors, id, isWorking, frame);

  // 팔
  const armY = y + CH.headH + 2 + bob;
  if (isWorking) {
    const ao = f%8<4 ? 0 : -2;
    rect(x - CH.armW + 1, armY + ao, CH.armW, 10, colors.body);
    rect(x + CH.headW, armY - ao, CH.armW, 10, colors.body);
    // 손
    rect(x - CH.armW + 1, armY + 9 + ao, 4, 3, colors.head);
    rect(x + CH.headW + 1, armY + 9 - ao, 4, 3, colors.head);
  } else {
    rect(x - CH.armW + 1, armY, CH.armW, 12, colors.body);
    rect(x + CH.headW, armY, CH.armW, 12, colors.body);
    rect(x - CH.armW + 1, armY + 11, 4, 3, colors.head);
    rect(x + CH.headW + 1, armY + 11, 4, 3, colors.head);
  }

  // 머리
  drawPersonHead(x, y + bob, colors, id, frame, isWorking);
}

// 걸어가는 캐릭터 (이동중)
function drawWalkingPerson(x, y, colors, frame, id) {
  const f = frame % 120;
  const bounce = Math.abs(Math.sin(f * 0.15)) * 3;
  id = id || 'coder';

  // 그림자
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath();
  ctx.ellipse(x + CH.headW/2, y + CH.totalH + 2, CH.headW/2 + 2, 3, 0, 0, Math.PI*2);
  ctx.fill();

  // 다리 (걷기 애니메이션)
  const legX = x + (CH.headW - CH.bodyW) / 2;
  const legY = y + CH.headH + CH.bodyH - bounce;
  const leg = f%12<6 ? 4 : -4;
  rect(legX+3+leg, legY, 5, CH.legH, '#3a3a5a');
  rect(legX+CH.bodyW-8-leg, legY, 5, CH.legH, '#3a3a5a');
  rect(legX+2+leg, legY+CH.legH-2, 7, 3, '#2a2a3a');
  rect(legX+CH.bodyW-9-leg, legY+CH.legH-2, 7, 3, '#2a2a3a');

  // 몸
  drawPersonBody(x, y + CH.headH - bounce, colors, id, false, frame);

  // 팔 흔들기
  const armY = y + CH.headH + 2 - bounce;
  const armSwing = Math.sin(f * 0.15) * 4;
  rect(x - CH.armW + 1, armY + armSwing, CH.armW, 12, colors.body);
  rect(x + CH.headW, armY - armSwing, CH.armW, 12, colors.body);
  rect(x - CH.armW + 1, armY + 11 + armSwing, 4, 3, colors.head);
  rect(x + CH.headW + 1, armY + 11 - armSwing, 4, 3, colors.head);

  // 머리
  drawPersonHead(x, y - bounce, colors, id, frame, false);
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

  ctx.fillStyle = isActive ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.15)';
  roundRect(nx, y, nw, 18, 4);

  if (isActive) {
    ctx.strokeStyle = 'rgba(46,204,113,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); rrPath(nx, y, nw, 18, 4); ctx.stroke();
  }

  ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillStyle = isActive ? '#fff' : '#ccc';
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
    const charX = dp.x + 28;
    const charY = dp.y - 14;
    const pos = updateCharPosition(member.id, charX, charY);

    const dist = Math.abs(pos.x - charX) + Math.abs(pos.y - charY);
    if (dist > 5) {
      drawWalkingPerson(pos.x, pos.y, colors, tick, member.id);
    } else {
      drawPerson(pos.x, pos.y, colors, false, tick + globalIdx * 25, member.id);
    }

    drawNameBadge(dp.cx, dp.y + 45, member.name, member.icon, false);

    const bubble = getBubble(member);
    if (bubble.visible) {
      if (bubble.type === 'transition') {
        drawWorkBubble(dp.cx, dp.y - 20, bubble.text, bubble.emoji, true);
      } else {
        drawIdleBubble(dp.cx, dp.y - 20, bubble.emoji, bubble.alpha || 1);
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
        drawWalkingPerson(pos.x, pos.y, colors, tick, member.id);
      } else {
        drawPerson(pos.x, pos.y, colors, true, tick + seatIdx * 25, member.id);
      }

      drawNameBadge(pos.x + CH.headW/2, pos.y + CH.totalH + 6, member.name, member.icon, true);

      const bubble = getBubble(member);
      if (bubble.visible) {
        drawWorkBubble(pos.x + CH.headW/2, pos.y - 10, bubble.text, bubble.emoji, bubble.type === 'transition');
      }
    });
  } else if (activeMembers.length === 1) {
    // 혼자 일하면 자기 자리에서
    const member = activeMembers[0];
    const globalIdx = crewData.indexOf(member);
    const dp = deskPos(globalIdx, crewData.length);
    const colors = getColors(member.id);
    const charX = dp.x + 28;
    const charY = dp.y - 14;
    const pos = updateCharPosition(member.id, charX, charY);

    const dist = Math.abs(pos.x - charX) + Math.abs(pos.y - charY);
    if (dist > 5) {
      drawWalkingPerson(pos.x, pos.y, colors, tick, member.id);
    } else {
      drawPerson(pos.x, pos.y, colors, true, tick + globalIdx * 25, member.id);
    }

    drawSmallDesk(dp.x, dp.y, true);

    drawNameBadge(dp.cx, dp.y + 45, member.name, member.icon, true);

    const bubble = getBubble(member);
    if (bubble.visible) {
      drawWorkBubble(dp.cx, dp.y - 20, bubble.text, bubble.emoji, bubble.type === 'transition');
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
