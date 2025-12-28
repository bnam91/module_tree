#!/usr/bin/env node
/**
 * 기존 로컬 state.json들을 MongoDB 컬렉션으로 일괄 업서트하는 스크립트.
 * 환경변수 우선:
 *   MONGODB_URI (필수)
 *   MONGODB_DB (기본: modules_DB)
 *   MONGODB_COLLECTION (기본: tree)
 *   TREE_STATE_ROOT (없으면 config.stateRoot, 없으면 ./state)
 */

const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
const config = require('./config');

async function main() {
  const mongoUri = process.env.MONGODB_URI || (config.mongo && config.mongo.uri);
  if (!mongoUri) {
    throw new Error('MONGODB_URI가 필요합니다.');
  }

  const dbName =
    process.env.MONGODB_DB || (config.mongo && config.mongo.dbName) || 'modules_DB';
  const collectionName =
    process.env.MONGODB_COLLECTION ||
    (config.mongo && config.mongo.collectionName) ||
    'tree';

  const stateRoot =
    process.env.TREE_STATE_ROOT || config.stateRoot || path.join(__dirname, 'state');

  if (!fs.existsSync(stateRoot)) {
    console.log(`[INFO] 상태 루트가 없습니다: ${stateRoot}`);
    return;
  }

  const client = new MongoClient(mongoUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 60_000,
    socketTimeoutMS: 60_000,
  });

  await client.connect();
  const collection = client.db(dbName).collection(collectionName);

  const projects = fs
    .readdirSync(stateRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (!projects.length) {
    console.log('[INFO] 마이그레이션할 프로젝트가 없습니다.');
    await client.close();
    return;
  }

  for (const project of projects) {
    const stateFile = path.join(stateRoot, project, 'state.json');
    if (!fs.existsSync(stateFile)) {
      console.log(`[WARN] state.json 없음, 건너뜀: ${project}`);
      continue;
    }

    try {
      const raw = fs.readFileSync(stateFile, 'utf8');
      const parsed = JSON.parse(raw);
      await collection.updateOne(
        { project },
        { $set: { project, state: parsed, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log(`[OK] migrated: ${project}`);
    } catch (err) {
      console.log(`[ERR] ${project} 마이그레이션 실패: ${err.message}`);
    }
  }

  await client.close();
  console.log('[DONE] 마이그레이션 완료');
}

main().catch((err) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});

