import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  deleteDoc, 
  updateDoc,
  writeBatch, 
  Timestamp,
  setLogLevel
} from 'firebase/firestore';

setLogLevel('error');
// ... (other imports)
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Compatibility layer to mimic Admin SDK API using Web SDK
class FirestoreCompat {
  collection(path: string) {
    return new CollectionCompat(path);
  }

  batch() {
    return writeBatch(firestore);
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, 
      email: null,
      emailVerified: null,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class CollectionCompat {
  private queryConstraints: any[] = [];
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

  doc(id: string) {
    return new DocCompat(this.path, id);
  }

  where(field: string, op: any, value: any) {
    this.queryConstraints.push(where(field, op, value));
    return this;
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
    this.queryConstraints.push(orderBy(field, dir));
    return this;
  }

  limit(n: number) {
    this.queryConstraints.push(limit(n));
    return this;
  }

  async get() {
    try {
      const colRef = collection(firestore, this.path);
      const q = this.queryConstraints.length > 0 
        ? query(colRef, ...this.queryConstraints)
        : colRef;
      
      const snap = await getDocs(q);
      return {
        empty: snap.empty,
        docs: snap.docs.map(d => ({
          id: d.id,
          data: () => d.data(),
          exists: d.exists()
        }))
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, this.path);
      throw error;
    }
  }
}

class DocCompat {
  private colPath: string;
  private id: string;
  
  constructor(colPath: string, id: string) {
    this.colPath = colPath;
    this.id = id;
  }

  async set(data: any) {
    try {
      return await setDoc(doc(firestore, this.colPath, this.id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${this.colPath}/${this.id}`);
      throw error;
    }
  }

  async update(data: any) {
    try {
      return await updateDoc(doc(firestore, this.colPath, this.id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${this.colPath}/${this.id}`);
      throw error;
    }
  }

  async delete() {
    try {
      return await deleteDoc(doc(firestore, this.colPath, this.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${this.colPath}/${this.id}`);
      throw error;
    }
  }

  async get() {
    try {
      const snap = await getDoc(doc(firestore, this.colPath, this.id));
      return {
        id: snap.id,
        exists: snap.exists(),
        data: () => snap.data()
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${this.colPath}/${this.id}`);
      throw error;
    }
  }

  onSnapshot(callback: (doc: any) => void, errorCallback?: (err: any) => void) {
    return onSnapshot(
      doc(firestore, this.colPath, this.id), 
      (snap) => {
        callback({
          id: snap.id,
          exists: snap.exists(),
          data: () => snap.data()
        });
      },
      errorCallback
    );
  }
}

export const adminDb = new FirestoreCompat() as any;
export const adminAuth = {
  verifyIdToken: async (token: string) => ({ uid: token }),
};
