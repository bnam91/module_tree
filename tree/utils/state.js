const fs = require('fs');
const { MongoClient, ServerApiVersion } = require('mongodb');

function getDefaultState() {
  return {
    labels: [],
    labelMap: {},
    hiddenPaths: [],
    showLabels: true,
    showHidden: false,
    disabledLabels: [],
    expandedPaths: [],
    noteContent: '',
    noteVisible: false,
    pathNotes: {},
    labelNotes: {},
  };
}

function normalizeState(raw) {
  const safe = typeof raw === 'object' && raw !== null ? raw : {};
  return {
    labels: Array.isArray(safe.labels) ? safe.labels : [],
    labelMap:
      typeof safe.labelMap === 'object' && safe.labelMap !== null ? safe.labelMap : {},
    hiddenPaths: Array.isArray(safe.hiddenPaths) ? safe.hiddenPaths : [],
    showLabels: safe.showLabels !== false,
    showHidden: !!safe.showHidden,
    disabledLabels: Array.isArray(safe.disabledLabels) ? safe.disabledLabels : [],
    expandedPaths: Array.isArray(safe.expandedPaths) ? safe.expandedPaths : [],
    noteContent: typeof safe.noteContent === 'string' ? safe.noteContent : '',
    noteVisible: !!safe.noteVisible,
    pathNotes: typeof safe.pathNotes === 'object' && safe.pathNotes !== null ? safe.pathNotes : {},
    labelNotes: typeof safe.labelNotes === 'object' && safe.labelNotes !== null ? safe.labelNotes : {},
  };
}

function createFileStore(stateFile, stateDir) {
  return {
    type: 'file',
    async load() {
      try {
        const raw = fs.readFileSync(stateFile, 'utf8');
        const parsed = JSON.parse(raw);
        return normalizeState(parsed);
      } catch (_) {
        return getDefaultState();
      }
    },
    async save(state) {
      const normalized = normalizeState(state);
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(normalized, null, 2), 'utf8');
    },
    async close() {},
  };
}

async function createMongoStore({ projectName, uri, dbName, collectionName }) {
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 60_000,
    socketTimeoutMS: 60_000,
  });

  try {
    await client.connect();
    // 연결 확인
    await client.db('admin').command({ ping: 1 });
    console.log('[INFO] MongoDB 연결 성공');
  } catch (err) {
    console.error('[ERROR] MongoDB 연결 실패:', err.message);
    await client.close();
    throw err;
  }
  
  const collection = client.db(dbName).collection(collectionName);

  return {
    type: 'mongo',
    async load() {
      const doc = await collection.findOne({ project: projectName });
      return normalizeState(doc && doc.state);
    },
    async save(state) {
      try {
        const normalized = normalizeState(state);
        const result = await collection.updateOne(
          { project: projectName },
          { $set: { project: projectName, state: normalized, updatedAt: new Date() } },
          { upsert: true }
        );
        if (result.upsertedCount > 0) {
          console.log(`[INFO] MongoDB: 새 프로젝트 상태 생성 (project=${projectName})`);
        } else if (result.modifiedCount > 0) {
          console.log(`[INFO] MongoDB: 프로젝트 상태 업데이트 (project=${projectName})`);
        }
      } catch (err) {
        console.error(`[ERROR] MongoDB 저장 실패 (project=${projectName}):`, err.message);
        throw err;
      }
    },
    async close() {
      await client.close();
    },
  };
}

async function createStateStore({
  projectName,
  stateFile,
  stateDir,
  mongo = {},
}) {
  const { uri, dbName, collectionName, requireMongo } = mongo;

  if (requireMongo) {
    if (!uri) {
      throw new Error('MONGODB_URI가 필요합니다. (requireMongo=true)');
    }
    const mongoStore = await createMongoStore({ projectName, uri, dbName, collectionName });
    console.log('[INFO] MongoDB 상태 저장소를 사용합니다. (폴백 없음)');
    return mongoStore;
  }

  if (uri) {
    try {
      const mongoStore = await createMongoStore({ projectName, uri, dbName, collectionName });
      console.log(`[INFO] MongoDB 상태 저장소를 사용합니다. (db=${dbName}, collection=${collectionName}, project=${projectName})`);
      return mongoStore;
    } catch (err) {
      console.error('[ERROR] MongoDB 연결 실패:', err.message);
      if (requireMongo) {
        throw err;
      }
      console.warn('[WARN] 로컬 파일 상태 저장소로 대체합니다.');
    }
  }

  return createFileStore(stateFile, stateDir);
}

module.exports = {
  createStateStore,
  getDefaultState,
};

