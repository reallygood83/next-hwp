# 한글소리 AI / HwpVoice

HWP/HWPX 문서를 짧은 브리핑 대본, 공유용 HTML, 음성 파일로 바꾸는 Next.js MVP입니다.

[GitHub](https://github.com/reallygood83/next-hwp) · [X @reallygood83](https://x.com/reallygood83) · [YouTube 배움의달인](https://www.youtube.com/@%EB%B0%B0%EC%9B%80%EC%9D%98%EB%8B%AC%EC%9D%B8-p5v)

> 한글소리 AI / HwpVoice는 재능기부 MVP 서비스입니다. 운영 비용, 사용량, 정책 변경에 따라 저장 기간 조정, 기능 제한, 또는 서비스 중단이 발생할 수 있습니다. 중요한 자료는 반드시 HTML, MP3, ZIP 등 로컬 파일로 별도 백업해 주세요.

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
- 공유 저장 파일은 Firebase Storage 규칙 기준 파일당 10MB 미만으로 제한
- Firebase Google 로그인으로 앱 사용 보호
- 교사/공무원 대상 랜딩페이지 제공
- 다문화 가정 학생·학부모 안내와 민원 답변을 다국어 음성 브리핑으로 배포하는 활용 시나리오 포함
- Firebase Storage에 공유 오디오 저장, Firestore에 공유 페이지용 구조화 데이터 저장
- 사용자별 내 공유 문서 관리 페이지 제공

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
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
GEMINI_TTS_VOICE=Kore
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

## Self Hosting

GitHub 저장소를 내려받아 직접 구축하는 사용자는 `.env.local`에 다음 값을 설정하면 공개 랜딩페이지 없이 작업페이지 중심으로 실행할 수 있습니다.

```bash
NEXT_PUBLIC_APP_ONLY=true
```

직접 구축 시에도 Firebase 프로젝트, Authentication authorized domains, Firestore rules, Storage rules를 본인 환경에 맞게 설정해야 합니다. 공개 배포용 랜딩페이지와 재능기부 MVP 안내는 운영자용 기본 서비스에 맞춘 구성이므로, 기관 내부 설치판에서는 `NEXT_PUBLIC_APP_ONLY=true` 사용을 권장합니다.

## 검증

```bash
npm run typecheck
npm run lint
npm run build
```

## 설계 메모

## Copyright

Copyright 2026. 주저작권자: reallygood83 배움의 달인.

## API Key Privacy

한글소리 AI / HwpVoice는 사용자가 입력한 Gemini API key와 ElevenLabs API key를 수집하거나 저장하지 않습니다. API key는 브리핑 대본 생성과 음성 합성 요청을 처리하는 동안에만 사용되며, Firestore, Firebase Storage, 공유 HTML, ZIP 파일, `/s/{id}` 공유 페이지에 포함하지 않습니다.

## Credits

이 프로젝트는 macOS 한글 문서 경험을 개선하는 `alhangeul` 프로젝트와 `rhwp`/`rhwp-studio` 뷰어에서 참고와 영감을 얻었습니다. 현재 웹 MVP는 HWP/HWPX 원문 표시를 위해 bundled `rhwp-studio` WASM 뷰어를 사용합니다.

HWP/HWPX 원문 보기는 `public/rhwp-studio/`에 포함된 `rhwp-studio` WASM 뷰어를 iframe으로 로드하고, 업로드한 파일 bytes를 `postMessage`로 전달합니다. 브리핑용 본문은 별도로 HWP OLE `BodyText/Section*` 또는 HWPX XML에서 추출합니다. 서버 API는 문서 원문과 API key를 로그에 남기지 않도록 작성되어 있습니다.

UI에 입력한 Gemini 또는 ElevenLabs API key는 브리핑 생성 요청에만 포함됩니다. 키는 서버 파일, 공유 HTML, ZIP 패키지, `/s/{id}` 공유 페이지에 저장하지 않습니다. 배포형 서비스에서는 사용자가 직접 API key를 입력해야 하며, 비워둔 상태에서는 음성 브리핑 생성을 막습니다.

공유 링크는 Firestore의 구조화된 브리핑 데이터와 Firebase Storage의 오디오 파일을 조합해 `/s/{id}` 서버 템플릿으로 제공합니다. 공유 페이지는 임의 HTML을 그대로 실행하지 않고 CSP를 적용합니다.

서버 비용과 유지 비용 선택지는 [Deployment and Cost Notes](docs/deployment-costs.md)를 참고하세요. 공개 운영에서는 사용자별 저장 개수 제한, 파일당 10MB 제한, 만료 정책, 로컬 백업 안내를 함께 유지하는 편이 안전합니다.
