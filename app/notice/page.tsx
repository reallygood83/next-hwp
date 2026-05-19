import Link from "next/link";
import { AlertTriangle, Download, FileAudio, Lock } from "lucide-react";

const githubUrl = "https://github.com/reallygood83/next-hwp";

export default function NoticePage() {
  return (
    <main className="notice-page">
      <nav className="landing-nav notice-nav">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">
            <FileAudio size={18} aria-hidden="true" />
          </span>
          <span className="brand-text">
            <span className="brand-title">한글소리 AI</span>
            <span className="brand-subtitle">HwpVoice</span>
          </span>
        </Link>
        <div className="nav-actions">
          <a className="secondary compact-button nav-link" href={githubUrl} target="_blank" rel="noreferrer">
            <Download size={16} />
            GitHub 다운로드
          </a>
          <Link className="primary compact-button nav-link" href="/app">
            <Lock size={16} />
            작업페이지
          </Link>
        </div>
      </nav>

      <section className="notice-card">
        <div className="notice-heading">
          <AlertTriangle size={26} aria-hidden="true" />
          <div>
            <p className="eyebrow">재능기부 MVP 서비스 안내</p>
            <h1>중요 자료는 항상 직접 백업해 주세요.</h1>
          </div>
        </div>

        <div className="notice-grid">
          <article>
            <h2>서비스 지속성</h2>
            <p>
              한글소리 AI는 재능기부로 운영하는 MVP입니다. 운영 비용, 사용량, 정책 변경에 따라
              저장 기간이 줄어들거나 일부 기능이 제한될 수 있으며, 서비스가 종료될 수도 있습니다.
            </p>
          </article>
          <article>
            <h2>백업 원칙</h2>
            <p>
              공유 링크는 임시 배포 수단입니다. 중요한 문서는 HTML, MP3, HTML+MP3 ZIP 파일로
              내려받아 개인 컴퓨터나 기관 저장소에 별도로 보관하세요.
            </p>
          </article>
          <article>
            <h2>API key 보안</h2>
            <p>
              사용자가 입력한 Gemini와 ElevenLabs API key는 수집하거나 저장하지 않습니다. 요청
              처리에만 사용하며 Firestore, Firebase Storage, 공유 HTML, ZIP 파일에 포함하지
              않습니다.
            </p>
          </article>
          <article>
            <h2>Google 로그인</h2>
            <p>
              Google 로그인은 사용자별 공유 저장소 소유자를 구분하기 위한 용도입니다. 현재 기본
              서비스는 Google Drive 권한을 요청하지 않으며, Drive 파일을 읽거나 쓰지 않습니다.
            </p>
          </article>
          <article>
            <h2>공유 제한</h2>
            <p>
              비용 관리를 위해 공유 파일은 파일당 15MB 이하로 제한합니다. 이후 사용자별 공유
              개수, 보관 기간, 자동 만료 정책이 추가될 수 있습니다.
            </p>
          </article>
          <article>
            <h2>직접 구축</h2>
            <p>
              계속 안정적으로 사용해야 한다면 GitHub 저장소를 내려받아 본인 Firebase/Vercel
              프로젝트로 직접 구축하는 방식을 권장합니다. 직접 구축 시 운영 비용과 데이터 보관
              정책을 직접 관리할 수 있습니다.
            </p>
          </article>
        </div>

        <div className="notice-actions">
          <Link className="primary hero-button nav-link" href="/app">
            작업페이지로 이동
          </Link>
          <a className="secondary compact-button nav-link" href={githubUrl} target="_blank" rel="noreferrer">
            GitHub에서 직접 구축하기
          </a>
        </div>
      </section>
    </main>
  );
}
