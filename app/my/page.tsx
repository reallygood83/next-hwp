"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { Copy, FileAudio, Lock, Trash2 } from "lucide-react";
import { listenToAuth, signInWithGoogle } from "@/lib/firebase";

type ShareItem = {
  id: string;
  title: string;
  sourceFilename: string;
  language: string;
  speechProvider: string;
  createdAt: string;
  expiresAt: string;
  sizeBytes: number;
};

export default function MySharesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [message, setMessage] = useState("");

  const loadShares = useCallback(async (nextUser = user) => {
    if (!nextUser) return;
    const idToken = await nextUser.getIdToken();
    const response = await fetch("/api/shares", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const body = (await response.json()) as { shares?: ShareItem[]; error?: string };
    if (!response.ok) {
      setMessage(body.error || "공유 목록을 불러오지 못했습니다.");
      return;
    }
    setShares(body.shares || []);
  }, [user]);

  useEffect(() => {
    return listenToAuth((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        void loadShares(nextUser);
      }
    });
  }, [loadShares]);

  async function deleteShare(id: string) {
    if (!user) return;
    const idToken = await user.getIdToken();
    const response = await fetch(`/api/shares/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) {
      setMessage("공유 문서를 삭제하지 못했습니다.");
      return;
    }
    setMessage("공유 문서를 삭제했습니다.");
    await loadShares();
  }

  async function copyLink(id: string) {
    await navigator.clipboard.writeText(new URL(`/s/${id}`, window.location.origin).toString());
    setMessage("공유 링크를 복사했습니다.");
  }

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
          <Link className="secondary compact-button nav-link" href="/notice">
            주의사항
          </Link>
          <Link className="primary compact-button nav-link" href="/app">
            작업페이지
          </Link>
        </div>
      </nav>

      <section className="notice-card">
        <div className="notice-heading">
          <FileAudio size={26} aria-hidden="true" />
          <div>
            <p className="eyebrow">내 공유 문서</p>
            <h1>공유 링크와 저장공간을 관리합니다.</h1>
          </div>
        </div>

        {!authReady ? <p className="hint">로그인 상태를 확인하고 있습니다.</p> : null}
        {authReady && !user ? (
          <div className="auth-inline">
            <p>내 공유 문서를 보려면 Google 로그인이 필요합니다.</p>
            <button className="primary compact-button" onClick={() => void signInWithGoogle()}>
              <Lock size={16} />
              Google 로그인
            </button>
          </div>
        ) : null}

        {user ? (
          <>
            <div className="quota-band">
              <strong>{shares.length} / 3개 사용 중</strong>
              <span>
                공개 공유는 재능기부 MVP 저장공간입니다. 중요한 자료는 HTML/MP3/ZIP으로 로컬
                백업하세요.
              </span>
            </div>
            {message ? <div className="share-message">{message}</div> : null}
            <div className="share-list">
              {shares.map((share) => (
                <article key={share.id} className="share-item">
                  <div>
                    <h2>{share.title}</h2>
                    <p>{share.sourceFilename}</p>
                    <span>
                      생성 {formatDate(share.createdAt)} · 만료 {formatDate(share.expiresAt)}
                    </span>
                  </div>
                  <div className="share-actions">
                    <a className="secondary compact-button nav-link" href={`/s/${share.id}`} target="_blank" rel="noreferrer">
                      열기
                    </a>
                    <button className="secondary compact-button" onClick={() => void copyLink(share.id)}>
                      <Copy size={15} />
                      복사
                    </button>
                    <button className="secondary compact-button danger" onClick={() => void deleteShare(share.id)}>
                      <Trash2 size={15} />
                      삭제
                    </button>
                  </div>
                </article>
              ))}
              {shares.length === 0 ? (
                <p className="hint">아직 저장된 공유 문서가 없습니다.</p>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}
