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

const firebaseConfig = {
  apiKey: "AIzaSyAzJWs_4Fe8Mt6z8PET1dHGsF9xBXUjX00",
  authDomain: "next-hwp.firebaseapp.com",
  projectId: "next-hwp",
  storageBucket: "next-hwp.firebasestorage.app",
  messagingSenderId: "175340390118",
  appId: "1:175340390118:web:1d02ec7685f1c4e78a1d27",
  measurementId: "G-RL19BQVS6P",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

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
