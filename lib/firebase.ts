"use client";

import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadString } from "firebase/storage";
import { firebaseConfig } from "./firebase-config";

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalytics() {
  if (typeof window === "undefined") return Promise.resolve(null);
  analyticsPromise ??= isSupported().then((supported) =>
    supported ? getAnalytics(firebaseApp) : null,
  );
  return analyticsPromise;
}

export function listenToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  return signInWithPopup(firebaseAuth, provider);
}

export function signOutUser() {
  return signOut(firebaseAuth);
}

export type FirebaseShareInput = {
  user: User;
  html: string;
  title: string;
  sourceFilename: string;
  language: string;
  speechProvider: string;
};

export async function createFirebaseShare({
  user,
  html,
  title,
  sourceFilename,
  language,
  speechProvider,
}: FirebaseShareInput) {
  const id = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
  const htmlPath = `briefings/${user.uid}/${id}/briefing.html`;
  const htmlRef = ref(firebaseStorage, htmlPath);

  await uploadString(htmlRef, html, "raw", {
    contentType: "text/html; charset=utf-8",
    customMetadata: {
      ownerUid: user.uid,
      shareId: id,
    },
  });

  const htmlUrl = await getDownloadURL(htmlRef);
  await setDoc(doc(firebaseDb, "sharedBriefings", id), {
    ownerUid: user.uid,
    ownerEmail: user.email || "",
    title,
    sourceFilename,
    language,
    speechProvider,
    htmlPath,
    htmlUrl,
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(firebaseDb, "users", user.uid),
    {
      email: user.email || "",
      displayName: user.displayName || "",
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { id, htmlUrl };
}
