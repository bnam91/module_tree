const path = require('path');

module.exports = {
  // 트리를 시작할 루트(기본: 상위 폴더). null이면 실행 위치/상위폴더 사용.
  projectRoot: null,

  // 상태 파일을 저장할 루트 디렉터리 (프로젝트명으로 하위 폴더 자동 생성)
  stateRoot: path.join(__dirname, 'state'),

  // 폴더 아이콘 이미지 경로 (없으면 기본 📁 이모지 사용)
  folderIconPath: path.join(__dirname, '..', 'src', 'folder_blue.png'),

  // MongoDB 연결 설정 (환경변수로 우선 설정 가능)
  mongo: {
    // 기본값을 코드에 직접 명시했습니다. 환경변수가 있으면 그것이 우선합니다.
    uri: 'mongodb+srv://coq3820:JmbIOcaEOrvkpQo1@cluster0.qj1ty.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    dbName: 'modules_DB',
    collectionName: 'tree',
    requireMongo: true, // true면 Mongo 연결 실패 시 폴백 없이 에러 (기본값: MongoDB만 사용)
  },

  // 트리 생성 시 제외할 항목
  ignore: ['node_modules', '.git', '.cursor', '.DS_Store'],

  // 서버 선호 포트 (null이면 가용 포트 자동 할당)
  preferPort: null,
};

