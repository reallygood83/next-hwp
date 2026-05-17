# next-hwp

HWP/HWPX 문서를 짧은 브리핑 대본, 공유용 HTML, MP3 음성으로 바꾸는 Next.js MVP입니다.

## 기능

- HWPX 파일에서 XML 텍스트 추출
- HWP 파일은 현재 안전한 fallback 안내 제공
- 텍스트 직접 붙여넣기 지원
- Gemini structured output 기반 브리핑 생성
- ElevenLabs TTS 기반 MP3 생성
- HTML+MP3 공유 패키지 다운로드

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
