# next-hwp

HWP/HWPX 문서를 짧은 브리핑 대본, 공유용 HTML, 음성 파일로 바꾸는 Next.js MVP입니다.

## 기능

- HWP 파일에서 OLE/BodyText 기반 본문 텍스트 추출
- HWPX 파일에서 XML 텍스트 추출
- HWP/HWPX 원문을 bundled `rhwp-studio` WASM 뷰어로 표시
- TXT/MD 문서를 페이지형 HTML 뷰어로 미리보기
- 텍스트 직접 붙여넣기 지원
- Gemini structured output 기반 브리핑 대본 생성
- 한국어/영어/일본어/중국어 브리핑 언어 선택
- 업무보고, 가정통신문, 학부모 안내, 민원 답변, 보고용 요약, 연수 안내, 회의 브리핑, 쉬운 말 설명, 다문화 가정 안내 등 브리핑 스타일 선택
- Gemini TTS 기본 음성 생성
- ElevenLabs API key와 Voice ID 직접 입력 기반 선택 음성 생성
- 외부 오디오 참조 HTML, 음성 포함 단일 HTML, HTML+오디오 zip 다운로드
- 변환된 음성 포함 HTML을 서버 저장공간에 저장하고 `/s/{id}` 공유 링크 생성
- Firebase Google 로그인으로 앱 사용 보호
- 교사/공무원 대상 랜딩페이지 제공
- 다문화 가정 학생·학부모 안내와 민원 답변을 다국어 음성 브리핑으로 배포하는 활용 시나리오 포함
- Firebase Storage에 공유 HTML 저장, Firestore에 공유 메타데이터 저장

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

Firebase 웹 앱 config는 `lib/firebase.ts`에 포함되어 있습니다. Firebase Console에서 Google 로그인 공급자를 활성화하고, 배포 도메인을 Authentication authorized domains에 추가해야 합니다.

Firebase 보안 규칙은 다음 명령으로 배포합니다.

```bash
firebase deploy --only firestore:rules,storage
```

`.env.local`에 다음 값을 설정합니다.

```bash
GEMINI_API_KEY=...
GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview
GEMINI_TTS_VOICE=Kore
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

## 검증

```bash
npm run typecheck
npm run lint
npm run build
```

## 설계 메모

HWP/HWPX 원문 보기는 `public/rhwp-studio/`에 포함된 `rhwp-studio` WASM 뷰어를 iframe으로 로드하고, 업로드한 파일 bytes를 `postMessage`로 전달합니다. 브리핑용 본문은 별도로 HWP OLE `BodyText/Section*` 또는 HWPX XML에서 추출합니다. 서버 API는 문서 원문과 API key를 로그에 남기지 않도록 작성되어 있습니다.

UI에 입력한 Gemini 또는 ElevenLabs API key는 브리핑 생성 요청에만 포함됩니다. 키는 서버 파일, 공유 HTML, ZIP 패키지, `/s/{id}` 공유 페이지에 저장하지 않습니다. 배포형 서비스에서는 사용자가 직접 API key를 입력해야 하며, 비워둔 상태에서는 음성 브리핑 생성을 막습니다.

공유 링크는 실행 중인 서버의 `.data/shares/`에 HTML을 저장하고 `/s/{id}`로 제공합니다. 로컬에서는 같은 머신/네트워크에서 접근 가능하며, Vercel이나 별도 서버에 배포하면 공개 공유 페이지로 사용할 수 있습니다.

서버 비용과 유지 비용 선택지는 [Deployment and Cost Notes](docs/deployment-costs.md)를 참고하세요. 현재 파일시스템 공유 저장소는 로컬 데모용이며, 공개 운영에서는 object storage adapter로 바꾸는 편이 안전합니다.
