#!/usr/bin/env node
/**
 * 공용 트리 도구 런처.
 * 실행한 디렉터리를 프로젝트 루트로 삼아 ./tree.js를 실행합니다.
 */

const { spawn } = require('child_process');
const path = require('path');

const TOOL_PATH = path.join(__dirname, 'tree.js');
const PROJECT_ROOT = process.cwd(); // 현재 작업 디렉터리가 대상 프로젝트
const env = {
  ...process.env,
  TREE_PROJECT_ROOT: PROJECT_ROOT,
  TREE_STATE_ROOT: process.env.TREE_STATE_ROOT || path.join(__dirname, 'state'),
  TREE_FOLDER_ICON:
    process.env.TREE_FOLDER_ICON || path.join(__dirname, '..', 'src', 'folder_blue.png'),
};

const proc = spawn('node', [TOOL_PATH], {
  stdio: 'inherit',
  cwd: PROJECT_ROOT,
  env,
});

proc.on('exit', (code) => process.exit(code || 0));

