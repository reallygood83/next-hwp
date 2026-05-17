import { firebaseConfig } from "./firebase-config";
import type { BriefingResult } from "./types";

export type FirebaseUserRecord = {
  uid: string;
  email: string;
  displayName: string;
};

export type ShareRecord = {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  title: string;
  sourceFilename: string;
  language: string;
  speechProvider: string;
  oneLineSummary: string;
  keyPoints: string[];
  briefingScript: string;
  htmlBody: string;
  caveats: string[];
  audioPath: string;
  audioMimeType: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  sizeBytes: number;
};

const firestoreBase = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseUserRecord> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );

  if (!response.ok) {
    throw new Error("Invalid Firebase ID token.");
  }

  const body = (await response.json()) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string }>;
  };
  const user = body.users?.[0];
  if (!user?.localId) {
    throw new Error("Firebase user not found.");
  }

  return {
    uid: user.localId,
    email: user.email || "",
    displayName: user.displayName || "",
  };
}

export async function countUserShares(idToken: string, uid: string) {
  const response = await fetch(`${firestoreBase}:runQuery`, {
    method: "POST",
    headers: firestoreHeaders(idToken),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "sharedBriefings" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "ownerUid" },
            op: "EQUAL",
            value: { stringValue: uid },
          },
        },
        limit: 10,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to count shares.");
  }

  const rows = (await response.json()) as Array<{ document?: unknown }>;
  return rows.filter((row) => row.document).length;
}

export async function listUserShares(idToken: string, uid: string) {
  const response = await fetch(`${firestoreBase}:runQuery`, {
    method: "POST",
    headers: firestoreHeaders(idToken),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "sharedBriefings" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "ownerUid" },
            op: "EQUAL",
            value: { stringValue: uid },
          },
        },
        limit: 20,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to list shares.");
  }

  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>;
  return rows
    .map((row) => (row.document ? parseShareDocument(row.document) : null))
    .filter((share): share is ShareRecord => Boolean(share))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getShareById(id: string) {
  const url = new URL(`${firestoreBase}/sharedBriefings/${id}`);
  url.searchParams.set("key", firebaseConfig.apiKey);
  const response = await fetch(url, {
    next: { revalidate: 60 },
  });
  if (!response.ok) return null;
  return parseShareDocument((await response.json()) as FirestoreDocument);
}

export async function createShareDocument({
  idToken,
  user,
  id,
  briefing,
  sourceFilename,
  language,
  speechProvider,
  audioPath,
  audioMimeType,
  sizeBytes,
}: {
  idToken: string;
  user: FirebaseUserRecord;
  id: string;
  briefing: BriefingResult;
  sourceFilename: string;
  language: string;
  speechProvider: string;
  audioPath: string;
  audioMimeType: string;
  sizeBytes: number;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const share: ShareRecord = {
    id,
    ownerUid: user.uid,
    ownerEmail: user.email,
    title: limitText(briefing.title || "한글소리 AI 음성 브리핑", 120),
    sourceFilename: limitText(sourceFilename, 180),
    language: limitText(language, 20),
    speechProvider: limitText(speechProvider, 30),
    oneLineSummary: limitText(briefing.oneLineSummary, 500),
    keyPoints: briefing.keyPoints.map((point) => limitText(point, 500)).slice(0, 8),
    briefingScript: limitText(briefing.briefingScript, 12000),
    htmlBody: limitText(briefing.htmlBody, 16000),
    caveats: briefing.caveats.map((caveat) => limitText(caveat, 500)).slice(0, 6),
    audioPath,
    audioMimeType,
    isPublic: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    sizeBytes,
  };

  const response = await fetch(`${firestoreBase}/sharedBriefings/${id}`, {
    method: "PATCH",
    headers: firestoreHeaders(idToken),
    body: JSON.stringify({ fields: shareToFields(share) }),
  });

  if (!response.ok) {
    throw new Error("Failed to create share document.");
  }

  await fetch(`${firestoreBase}/users/${user.uid}`, {
    method: "PATCH",
    headers: firestoreHeaders(idToken),
    body: JSON.stringify({
      fields: {
        email: stringValue(user.email),
        displayName: stringValue(user.displayName),
        lastActiveAt: timestampValue(now.toISOString()),
      },
    }),
  }).catch(() => undefined);

  return share;
}

export async function deleteShareDocument(idToken: string, id: string) {
  const response = await fetch(`${firestoreBase}/sharedBriefings/${id}`, {
    method: "DELETE",
    headers: firestoreHeaders(idToken),
  });
  return response.ok;
}

export function storageMediaUrl(path: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(
    path,
  )}?alt=media`;
}

function firestoreHeaders(idToken: string) {
  return {
    "Authorization": `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };
}

type FirestoreValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
};

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

function parseShareDocument(document: FirestoreDocument): ShareRecord | null {
  const fields = document.fields;
  if (!fields) return null;
  const id = document.name?.split("/").pop() || stringField(fields.id);
  if (!id) return null;
  return {
    id,
    ownerUid: stringField(fields.ownerUid),
    ownerEmail: stringField(fields.ownerEmail),
    title: stringField(fields.title),
    sourceFilename: stringField(fields.sourceFilename),
    language: stringField(fields.language),
    speechProvider: stringField(fields.speechProvider),
    oneLineSummary: stringField(fields.oneLineSummary),
    keyPoints: arrayStringField(fields.keyPoints),
    briefingScript: stringField(fields.briefingScript),
    htmlBody: stringField(fields.htmlBody),
    caveats: arrayStringField(fields.caveats),
    audioPath: stringField(fields.audioPath),
    audioMimeType: stringField(fields.audioMimeType),
    isPublic: Boolean(fields.isPublic?.booleanValue),
    createdAt: stringField(fields.createdAt) || fields.createdAt?.timestampValue || "",
    updatedAt: stringField(fields.updatedAt) || fields.updatedAt?.timestampValue || "",
    expiresAt: stringField(fields.expiresAt) || fields.expiresAt?.timestampValue || "",
    sizeBytes: Number(fields.sizeBytes?.integerValue || 0),
  };
}

function shareToFields(share: ShareRecord): Record<string, FirestoreValue> {
  return {
    id: stringValue(share.id),
    ownerUid: stringValue(share.ownerUid),
    ownerEmail: stringValue(share.ownerEmail),
    title: stringValue(share.title),
    sourceFilename: stringValue(share.sourceFilename),
    language: stringValue(share.language),
    speechProvider: stringValue(share.speechProvider),
    oneLineSummary: stringValue(share.oneLineSummary),
    keyPoints: arrayValue(share.keyPoints),
    briefingScript: stringValue(share.briefingScript),
    htmlBody: stringValue(share.htmlBody),
    caveats: arrayValue(share.caveats),
    audioPath: stringValue(share.audioPath),
    audioMimeType: stringValue(share.audioMimeType),
    isPublic: { booleanValue: share.isPublic },
    createdAt: timestampValue(share.createdAt),
    updatedAt: timestampValue(share.updatedAt),
    expiresAt: timestampValue(share.expiresAt),
    sizeBytes: { integerValue: String(share.sizeBytes) },
  };
}

function stringValue(value: string): FirestoreValue {
  return { stringValue: value || "" };
}

function timestampValue(value: string): FirestoreValue {
  return { timestampValue: value };
}

function arrayValue(values: string[]): FirestoreValue {
  return { arrayValue: { values: values.map(stringValue) } };
}

function stringField(value?: FirestoreValue) {
  return value?.stringValue || "";
}

function arrayStringField(value?: FirestoreValue) {
  return value?.arrayValue?.values?.map((item) => item.stringValue || "").filter(Boolean) || [];
}

function limitText(value: string, max: number) {
  return String(value || "").slice(0, max);
}
