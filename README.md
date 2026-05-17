# next-hwp

HWP/HWPX 문서를 짧은 브리핑 대본, 공유용 HTML, MP3 음성으로 바꾸는 Next.js MVP입니다.

## 기능

- HWPX 파일에서 XML 텍스트 추출
- HWPX/TXT/MD 문서를 페이지형 HTML 뷰어로 미리보기
- HWP 파일은 현재 안전한 fallback 안내 제공
- 텍스트 직접 붙여넣기 지원
- Gemini structured output 기반 브리핑 생성
- ElevenLabs TTS 기반 MP3 생성
- 외부 MP3 참조 HTML, 음성 포함 단일 HTML, HTML+MP3 zip 다운로드
- 변환된 음성 포함 HTML을 서버 저장공간에 저장하고 `/s/{id}` 공유 링크 생성

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 다음 값을 설정합니다.

```bash
GEMINI_API_KEY=...
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

HWPX는 zip 내부 XML 텍스트를 추출합니다. HWP 바이너리는 별도 parser/bridge가 필요하므로 MVP에서는 명확한 fallback으로 처리합니다. 서버 API는 문서 원문과 API key를 로그에 남기지 않도록 작성되어 있습니다.

공유 링크는 실행 중인 서버의 `.data/shares/`에 HTML을 저장하고 `/s/{id}`로 제공합니다. 로컬에서는 같은 머신/네트워크에서 접근 가능하며, Vercel이나 별도 서버에 배포하면 공개 공유 페이지로 사용할 수 있습니다.

서버 비용과 유지 비용 선택지는 [Deployment and Cost Notes](docs/deployment-costs.md)를 참고하세요. 현재 파일시스템 공유 저장소는 로컬 데모용이며, 공개 운영에서는 object storage adapter로 바꾸는 편이 안전합니다.
