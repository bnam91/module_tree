#!/usr/bin/env node

/**
 * 현재 스크립트의 상위 폴더(ali_crawler)의 디렉터리 트리를
 * HTML 파일로 생성하고 기본 브라우저로 열어주는 간단한 도구입니다.
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('./config');
const { buildTree } = require('./utils/buildTree');
const { createStateStore } = require('./utils/state');
const { createHtml } = require('./utils/html');
const { startServer } = require('./utils/server');

// 트리를 시작할 루트: 환경변수 > config > 기본(현재 폴더 상위)
const ROOT_DIR =
  process.env.TREE_PROJECT_ROOT ||
  config.projectRoot ||
  path.resolve(__dirname, '..');
const OUTPUT_HTML = path.join(__dirname, 'tree.html');

// 지나치게 큰/불필요한 항목을 기본적으로 제외
const IGNORE = new Set(
  Array.isArray(config.ignore) && config.ignore.length
    ? config.ignore
    : ['node_modules', '.git', '.cursor', '.DS_Store']
);

// 상태 저장소 (프로젝트별)
const PROJECT_NAME = path.basename(ROOT_DIR);
const STATE_ROOT =
  process.env.TREE_STATE_ROOT ||
  config.stateRoot ||
  path.join(__dirname, 'state');
const STATE_DIR = path.join(STATE_ROOT, PROJECT_NAME);
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const CSS_FILE = path.join(__dirname, 'tree.css');

// 폴더 아이콘 경로
const FOLDER_ICON_PATH =
  process.env.TREE_FOLDER_ICON ||
  config.folderIconPath ||
  path.join(__dirname, '..', 'src', 'folder_blue.png');
let FOLDER_ICON_DATA_URI = null;
try {
  const iconBase64 = fs.readFileSync(FOLDER_ICON_PATH).toString('base64');
  FOLDER_ICON_DATA_URI = `data:image/png;base64,${iconBase64}`;
} catch (err) {
  console.warn('[WARN] 폴더 아이콘을 불러오지 못했습니다. 기본 이모지로 대체합니다.', err.message);
}

const preferPort = Number(process.env.TREE_PREFER_PORT || config.preferPort) || 0;

// MongoDB 설정 (env 우선)
const MONGO_URI =
  process.env.MONGODB_URI || (config.mongo && config.mongo.uri) || '';
const MONGO_DB =
  process.env.MONGODB_DB || (config.mongo && config.mongo.dbName) || 'modules_DB';
const MONGO_COLLECTION =
  process.env.MONGODB_COLLECTION ||
  (config.mongo && config.mongo.collectionName) ||
  'tree';
const REQUIRE_MONGO =
  process.env.TREE_REQUIRE_MONGO === '1' ||
  process.env.TREE_REQUIRE_MONGO === 'true' ||
  (config.mongo && config.mongo.requireMongo);

const buildTreeForRoot = () => buildTree(ROOT_DIR, '', IGNORE);

function openInBrowser(targetUrl) {
  const platform = process.platform;
  const command =
    platform === 'darwin'
      ? `open "${targetUrl}"`
      : platform === 'win32'
      ? `start "" "${targetUrl}"`
      : `xdg-open "${targetUrl}"`;

  exec(command, (err) => {
    if (err) {
      console.log('[WARN] 자동으로 브라우저를 열지 못했습니다. 아래 URL을 직접 열어주세요.');
      console.log(targetUrl);
    }
  });
}

async function main() {
  const stateStore = await createStateStore({
    projectName: PROJECT_NAME,
    stateFile: STATE_FILE,
    stateDir: STATE_DIR,
    mongo: {
      uri: MONGO_URI,
      dbName: MONGO_DB,
      collectionName: MONGO_COLLECTION,
      requireMongo: REQUIRE_MONGO,
    },
  });

  const usingMongo = stateStore.type === 'mongo';
  const loadState = () => stateStore.load();
  const saveState = (state) => stateStore.save(state);

  const treeData = buildTreeForRoot();
  const initialState = await loadState();
  const html = createHtml({
    treeData,
    initialState,
    rootDir: ROOT_DIR,
    folderIconDataUri: FOLDER_ICON_DATA_URI,
  });

  fs.mkdirSync(path.dirname(OUTPUT_HTML), { recursive: true });
  fs.writeFileSync(OUTPUT_HTML, html, 'utf8');

  console.log('[INFO] 트리 생성 완료 (tree.html은 백업용으로 생성)');
  if (usingMongo) {
    console.log(
      `[INFO] 상태 저장: MongoDB (db=${MONGO_DB}, collection=${MONGO_COLLECTION}, project=${PROJECT_NAME})`
    );
  } else {
    console.log(`[INFO] 상태 파일: ${STATE_FILE}`);
  }

  startServer(html, {
    cssFile: CSS_FILE,
    preferPort,
    buildTree: buildTreeForRoot,
    loadState,
    saveState,
    openInBrowser,
  });
}

main().catch((err) => {
  console.error('[ERROR] 트리 생성/서버 구동 중 오류가 발생했습니다.', err);
  process.exit(1);
});
