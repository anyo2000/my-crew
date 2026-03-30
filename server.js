const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3333;
const WORKSPACE = path.join(require('os').homedir(), 'Desktop/workspace');
const ACTIVE_SEC = 30; // 30초 이내 변경 = 활동중

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

// ========================================
// 직업별 파일 패턴
// ========================================

const WORKERS = [
  {
    id: 'artist',
    name: '비주얼리',
    icon: '🎨',
    extensions: ['.jpg', '.jpeg', '.png', '.svg', '.webp', '.gif', '.bmp', '.ico'],
    workingLines: [
      '카드뉴스 그리는 중',
      '이미지 만드는 중',
      '색감 조절 중',
      '레이아웃 잡는 중',
      '배경 작업 중',
    ],
    idleLines: [
      '레퍼런스 구경 중',
      '팔레트 고르는 중',
      '인스타 보는 중',
    ],
  },
  {
    id: 'writer',
    name: '김작가',
    icon: '✍️',
    extensions: ['.md', '.txt', '.mdx'],
    workingLines: [
      '문서 작성 중',
      '기획서 쓰는 중',
      '대본 쓰는 중',
      '내용 다듬는 중',
      '문장 고치는 중',
    ],
    idleLines: [
      '책 읽는 중',
      '영감 기다리는 중',
      '낙서 중',
    ],
  },
  {
    id: 'coder',
    name: '코드 박',
    icon: '💻',
    extensions: ['.js', '.ts', '.tsx', '.jsx', '.py', '.sh'],
    workingLines: [
      '코딩 중',
      '버그 잡는 중',
      '함수 만드는 중',
      '리팩토링 중',
      '로직 짜는 중',
    ],
    idleLines: [
      '스택오버플로 보는 중',
      'GPT한테 물어보는 중',
      '커피 리필',
    ],
  },
  {
    id: 'publisher',
    name: '웹반장',
    icon: '🌐',
    extensions: ['.html', '.css', '.scss'],
    workingLines: [
      '페이지 만드는 중',
      '스타일 잡는 중',
      'HTML 짜는 중',
      '반응형 맞추는 중',
      '레이아웃 코딩 중',
    ],
    idleLines: [
      'Codepen 구경 중',
      '트렌드 사이트 서핑',
      'CSS 실험 중',
    ],
  },
  {
    id: 'designer',
    name: '디자인 킴',
    icon: '📊',
    extensions: [],
    folderHints: ['slide', 'ppt', 'presentation', 'output', 'deck'],
    workingLines: [
      '슬라이드 만드는 중',
      '차트 그리는 중',
      '디자인 다듬는 중',
      '애니메이션 넣는 중',
      '레이아웃 잡는 중',
    ],
    idleLines: [
      '템플릿 구경 중',
      '폰트 고르는 중',
      '스케치 중',
    ],
  },
  {
    id: 'planner',
    name: '기획 장',
    icon: '🧠',
    extensions: [],
    fileNames: ['README.md', 'CLAUDE.md', 'package.json', 'tsconfig.json', '.env', 'config.js', 'config.ts', 'settings.json'],
    workingLines: [
      '구상 중',
      '설계 도면 그리는 중',
      '구조 잡는 중',
      '프로젝트 세팅 중',
      '아키텍처 고민 중',
    ],
    idleLines: [
      '아이디어 떠올리는 중',
      '화이트보드 앞에서 고민',
      '트렌드 리서치 중',
    ],
  },
  {
    id: 'organizer',
    name: '최정리',
    icon: '📋',
    extensions: ['.json', '.csv', '.yaml', '.yml', '.toml', '.xml', '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.key', '.rtf', '.hwp'],
    excludeFileNames: ['package.json', 'tsconfig.json', 'settings.json'],
    workingLines: [
      '문서 정리 중',
      '파일 분류 중',
      '보고서 만드는 중',
      '자료 취합 중',
      '서류 검토 중',
    ],
    idleLines: [
      '서랍 정리 중',
      '라벨 붙이는 중',
      '폴더 구조 고민',
    ],
  },
];

// ========================================
// 전체 워크스페이스 스캔 → 최근 변경 파일 수집
// ========================================

function scanRecentFiles() {
  try {
    const result = execSync(
      `find "${WORKSPACE}" -maxdepth 4 ` +
      `-not -path "*/node_modules/*" ` +
      `-not -path "*/.git/*" ` +
      `-not -path "*/.next/*" ` +
      `-not -path "*/dist/*" ` +
      `-not -path "*/__pycache__/*" ` +
      `-not -path "*/.cache/*" ` +
      `-type f -mmin -1 2>/dev/null || true`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    if (!result) return [];

    const now = Date.now();
    const files = [];

    for (const f of result.split('\n').filter(Boolean)) {
      try {
        const stat = fs.statSync(f);
        if (now - stat.mtimeMs < ACTIVE_SEC * 1000) {
          const rel = path.relative(WORKSPACE, f);
          const parts = rel.split(path.sep);
          files.push({
            path: f,
            rel: rel,
            repo: parts[0] || '',
            fileName: path.basename(f),
            ext: path.extname(f).toLowerCase(),
            age: now - stat.mtimeMs,
          });
        }
      } catch (e) { /* skip */ }
    }

    return files;
  } catch (e) {
    return [];
  }
}

// ========================================
// 파일 → 직업 매칭
// ========================================

function matchWorker(worker, file) {
  // 파일명 직접 매칭 (기획자)
  if (worker.fileNames && worker.fileNames.includes(file.fileName)) {
    return true;
  }

  // 제외 파일 (정리왕에서 package.json 제외)
  if (worker.excludeFileNames && worker.excludeFileNames.includes(file.fileName)) {
    return false;
  }

  // 확장자 매칭
  if (worker.extensions.includes(file.ext)) {
    return true;
  }

  // 폴더 힌트 (PPT장인)
  if (worker.folderHints) {
    const lowerPath = file.rel.toLowerCase();
    if (worker.folderHints.some(hint => lowerPath.includes(hint))) {
      return true;
    }
  }

  return false;
}

// ========================================
// 크루 상태 생성
// ========================================

function getCrewStatus() {
  const recentFiles = scanRecentFiles();

  const crew = WORKERS.map(worker => {
    const matchedFiles = recentFiles.filter(f => matchWorker(worker, f));
    const isActive = matchedFiles.length > 0;

    // 활동중이면 구체적인 정보
    let label = '';
    let detail = '';
    let detailRepo = '';

    if (isActive) {
      // 가장 최근 파일 기준
      const latest = matchedFiles.sort((a, b) => a.age - b.age)[0];
      const linePool = worker.workingLines;
      label = linePool[Math.floor(Date.now() / 5000) % linePool.length];
      detail = latest.fileName;
      detailRepo = latest.repo;
    } else {
      const linePool = worker.idleLines;
      label = linePool[Math.floor(Date.now() / 8000) % linePool.length];
    }

    return {
      name: worker.name,
      id: worker.id,
      icon: worker.icon,
      action: isActive ? 'working' : 'idle',
      label,
      detail,
      detailRepo,
      fileCount: matchedFiles.length,
    };
  });

  return crew;
}

// ========================================
// HTTP 서버
// ========================================

const server = http.createServer((req, res) => {
  if (req.url === '/api/status') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(getCrewStatus()));
    return;
  }

  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🏢 My Crew Office is open!`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Watching: ${WORKSPACE}`);
  console.log(`   Workers: ${WORKERS.map(w => w.icon + w.name).join(' ')}\n`);
});
