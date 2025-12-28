# module_tree

간단한 디렉터리 트리 뷰어/서버 도구. 프로젝트를 서브모듈로 포함해 실행 디렉터리 기준으로 트리를 생성하고 브라우저에서 확인합니다.

## 버전
- `1.0.0`

## 디렉터리 구조(요약)
- `tree/` : 실행 스크립트와 서버 코드
  - `tree_scripts.js` : 런처 (프로젝트 루트에서 실행 권장)
  - `tree.js` : 메인 로직
  - `utils/` : 빌드/상태/서버/HTML 유틸
  - `state/` : 로컬 상태 캐시(폴백용, `.gitignore` 처리)
- `src/` : 아이콘 자원
- `legacy/` : 이전 마이그레이션 스크립트 등

## 설치
```bash
cd modules/module_tree
npm install
```

## 실행 예시
**⚠️ 중요: MongoDB URI가 필수입니다. 환경변수로 설정해주세요.**

프로젝트 루트에서:
```bash
MONGODB_URI="mongodb+srv://user:pass@cluster0.example.mongodb.net/?retryWrites=true&w=majority" \
MONGODB_DB=modules_DB \
MONGODB_COLLECTION=tree \
node modules/module_tree/tree/tree_scripts.js
```

환경변수로 옵션을 줄 수 있습니다.
- `MONGODB_URI` : MongoDB Atlas 등 연결 URI (**필수**)
- `MONGODB_DB` : 기본 `modules_DB`
- `MONGODB_COLLECTION` : 기본 `tree`
- `TREE_REQUIRE_MONGO` : 기본값 `true` (Mongo 실패 시 폴백 없이 에러)
- `TREE_PROJECT_ROOT` : 트리 루트 강제 지정(없으면 실행 디렉터리/상위)
- `TREE_FOLDER_ICON` : 폴더 아이콘 이미지 경로
- `TREE_PREFER_PORT` : 선호 포트(없으면 가용 포트 자동 할당)

### 로컬 파일 폴백 사용 (비권장)
로컬 파일 저장소를 사용하려면 `TREE_REQUIRE_MONGO=false`로 설정:
```bash
TREE_REQUIRE_MONGO=false \
node modules/module_tree/tree/tree_scripts.js
```

## 상태 저장 방식
- **기본값**: MongoDB만 사용 (`requireMongo: true`)
- MongoDB URI가 설정되면 컬렉션에 `{ project, state, updatedAt }`로 업서트
- URI가 없거나 `TREE_REQUIRE_MONGO=false`인 경우에만 로컬 `tree/state/<프로젝트>/state.json` 사용 (폴백)

## 마이그레이션(legacy)
`legacy/migrate_state_to_mongo.js` : 기존 `tree/state`의 `state.json`들을 Mongo 컬렉션으로 업서트하는 스크립트. 필요 시 환경변수로 `MONGODB_URI`, `MONGODB_DB`, `MONGODB_COLLECTION`을 설정해 실행하세요.

## 서브모듈 사용 팁
- 상위 프로젝트에 서브모듈로 추가 후 상위 루트에서 실행하면 현재 작업 디렉터리가 자동으로 트리 루트가 됩니다.
- 절대경로 의존 없음. `npm install`만 서브모듈 내부에서 한 번 수행하면 됩니다.

