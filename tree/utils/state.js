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

  await client.connect();
  const collection = client.db(dbName).collection(collectionName);

  return {
    type: 'mongo',
    async load() {
      const doc = await collection.findOne({ project: projectName });
      return normalizeState(doc && doc.state);
    },
    async save(state) {
      const normalized = normalizeState(state);
      await collection.updateOne(
        { project: projectName },
        { $set: { project: projectName, state: normalized, updatedAt: new Date() } },
        { upsert: true }
      );
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
      console.log('[INFO] MongoDB 상태 저장소를 사용합니다.');
      return mongoStore;
    } catch (err) {
      console.warn('[WARN] MongoDB 연결 실패, 로컬 파일 상태 저장소로 대체합니다.', err.message);
    }
  }

  return createFileStore(stateFile, stateDir);
}

module.exports = {
  createStateStore,
  getDefaultState,
};

