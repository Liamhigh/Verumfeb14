import { EvidenceArtifact } from "../types";
import { sha512 } from "./crypto";

const DB_NAME = "VerumOmnisDB";
const DB_VERSION = 1;
const STORE_NAME = "cases";

export interface CaseRecord {
  id: string;
  name: string;
  timestamp: number;
  report: string;
  evidence: EvidenceArtifact[];
  caseHash: string;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
};

export const saveCase = async (caseId: string, name: string, report: string, evidence: EvidenceArtifact[]): Promise<CaseRecord> => {
  const db = await initDB();
  
  // Calculate a "Super Hash" of the entire case for tamper sealing
  const evidenceHashes = evidence.map(e => e.cryptographicHash).join("");
  const reportHash = await sha512(report);
  const caseHash = await sha512(evidenceHashes + reportHash);

  const record: CaseRecord = {
    id: caseId,
    name: name || `Case ${caseId.substring(0, 8)}`,
    timestamp: Date.now(),
    report,
    evidence,
    caseHash
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
};

export const loadCases = async (): Promise<CaseRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteCase = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearAllCases = async (): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
