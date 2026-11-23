import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type User } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function isUserContactVerified(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified || (user.phoneNumber && user.phoneNumber.length >= 7));
}

export interface VerifiedAccountProfile {
  uid: string;
  displayName: string;
  contactMethod: 'email' | 'mobile' | 'google';
  verified: boolean;
  ageVerified18Plus: boolean;
  email: string;
  phoneNumber: string;
}

export async function syncVerifiedUserProfile(params: {
  user: User;
  displayName: string;
  contactMethod: 'email' | 'mobile' | 'google';
  email: string;
  phoneNumber: string;
}): Promise<VerifiedAccountProfile> {
  const { user, displayName, contactMethod, email, phoneNumber } = params;
  const cleanName = displayName.trim().slice(0, 48) || 'Darling';
  const cleanEmail = email.trim().slice(0, 160);
  const cleanPhone = phoneNumber.trim().slice(0, 32);

  const userPath = `users/${user.uid}`;
  const contactPath = `users/${user.uid}/private/contact`;

  let existsAlready = false;
  try {
    const existingSnap = await getDoc(doc(db, 'users', user.uid));
    existsAlready = existingSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  try {
    if (!existsAlready) {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: cleanName,
        contactMethod,
        verified: true,
        ageVerified18Plus: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          displayName: cleanName,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existsAlready ? OperationType.UPDATE : OperationType.CREATE,
      userPath
    );
  }

  try {
    await setDoc(doc(db, 'users', user.uid, 'private', 'contact'), {
      uid: user.uid,
      email: cleanEmail,
      phoneNumber: cleanPhone,
      verifiedMethod: contactMethod,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, contactPath);
  }

  return {
    uid: user.uid,
    displayName: cleanName,
    contactMethod,
    verified: true,
    ageVerified18Plus: true,
    email: cleanEmail,
    phoneNumber: cleanPhone,
  };
}

export async function loadVerifiedUserProfile(
  user: User
): Promise<VerifiedAccountProfile | null> {
  if (!isUserContactVerified(user)) return null;
  const userPath = `users/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return null;
    const data = snap.data();

    let email = user.email || '';
    let phoneNumber = user.phoneNumber || '';
    try {
      const privateSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'contact'));
      if (privateSnap.exists()) {
        const pData = privateSnap.data();
        email = typeof pData.email === 'string' ? pData.email : email;
        phoneNumber = typeof pData.phoneNumber === 'string' ? pData.phoneNumber : phoneNumber;
      }
    } catch {
      // Fall back to auth token info if private contact not yet written
    }

    return {
      uid: user.uid,
      displayName: typeof data.displayName === 'string' ? data.displayName : 'Darling',
      contactMethod:
        data.contactMethod === 'mobile' || data.contactMethod === 'google'
          ? data.contactMethod
          : 'email',
      verified: Boolean(data.verified),
      ageVerified18Plus: Boolean(data.ageVerified18Plus),
      email,
      phoneNumber,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}
