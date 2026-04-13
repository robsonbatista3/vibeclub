import { auth, db, storage } from "../firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  getDocFromServer,
  deleteDoc
} from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      const isAdminEmail = user.email === "robsonbatista3@gmail.com";
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: user.displayName || "Usuário",
        photoURL: user.photoURL || "",
        bio: "",
        coins: 0,
        role: isAdminEmail ? "admin" : "user",
        createdAt: serverTimestamp()
      });
    }
    return user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

export const purchaseCoins = async (userId: string, amount: number) => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const currentCoins = userDoc.data().coins || 0;
      await updateDoc(userRef, {
        coins: currentCoins + amount
      });
      
      // Record transaction
      await addDoc(collection(db, "transactions"), {
        userId,
        amount: amount / 10, // Example: 10 coins = R$ 1
        coins: amount,
        type: "purchase",
        status: "completed",
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
};

export const submitCreatorApplication = async (userId: string, userName: string, userEmail: string, reason: string, socialMedia: string) => {
  try {
    await addDoc(collection(db, "creator_applications"), {
      userId,
      userName,
      userEmail,
      reason,
      socialMedia,
      status: "pending",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "creator_applications");
  }
};

export const approveCreatorApplication = async (applicationId: string, userId: string) => {
  try {
    await updateDoc(doc(db, "creator_applications", applicationId), {
      status: "approved"
    });
    await updateDoc(doc(db, "users", userId), {
      role: "creator"
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `creator_applications/${applicationId}`);
  }
};

export const rejectCreatorApplication = async (applicationId: string) => {
  try {
    await updateDoc(doc(db, "creator_applications", applicationId), {
      status: "rejected"
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `creator_applications/${applicationId}`);
  }
};

export const joinLiveSlot = async (liveId: string, userId: string, userName: string, photoURL: string, currentSlots: any[]) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) throw new Error("User not found");
    const userData = userSnap.data();
    
    if (userData.coins < 20) {
      throw new Error("Saldo insuficiente. Você precisa de 20 moedas.");
    }

    // Deduct coins
    await updateDoc(userRef, {
      coins: userData.coins - 20
    });

    // Add to slots
    const newSlots = [...(currentSlots || []), { userId, userName, photoURL }];
    await updateDoc(doc(db, "lives", liveId), {
      slots: newSlots
    });

    // Record transaction
    await addDoc(collection(db, "transactions"), {
      userId,
      amount: 20,
      type: "window",
      status: "completed",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `lives/${liveId}`);
  }
};

export const updateMaxWindows = async (liveId: string, count: number) => {
  try {
    await updateDoc(doc(db, "lives", liveId), {
      maxWindows: count
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `lives/${liveId}`);
  }
};

export const sendGift = async (liveId: string, userId: string, userName: string, amount: number) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) throw new Error("User not found");
    const userData = userSnap.data();
    
    if (userData.coins < amount) {
      throw new Error(`Saldo insuficiente. Você precisa de ${amount} moedas.`);
    }

    // Deduct coins
    await updateDoc(userRef, {
      coins: userData.coins - amount
    });

    // Add gift message
    await addDoc(collection(db, "lives", liveId, "messages"), {
      userId,
      userName,
      text: `enviou um presente`,
      isGift: true,
      giftAmount: amount,
      createdAt: serverTimestamp()
    });

    // Record transaction
    await addDoc(collection(db, "transactions"), {
      userId,
      amount: amount,
      type: "gift",
      status: "completed",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
};

export const manuallyAddCoins = async (userId: string, amount: number) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User not found");
    
    const currentCoins = userSnap.data().coins || 0;
    await updateDoc(userRef, {
      coins: currentCoins + amount
    });
    
    // Record transaction
    await addDoc(collection(db, "transactions"), {
      userId,
      amount: 0, // Manual addition has no monetary cost for the user
      coins: amount,
      type: "admin_manual",
      status: "completed",
      createdAt: serverTimestamp(),
      adminAction: true
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
};

export const createNotification = async (notification: {
  userId: string,
  type: 'follower' | 'gift' | 'system',
  title: string,
  message: string,
  fromId?: string,
  fromName?: string,
  fromPhoto?: string
}) => {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notification,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "notifications");
  }
};

export const followUser = async (followerId: string, followedId: string, followerName: string, followerPhoto: string) => {
  try {
    const followId = `${followerId}_${followedId}`;
    await setDoc(doc(db, "followers", followId), {
      followerId,
      followedId,
      createdAt: serverTimestamp()
    });

    // Create notification for the followed user
    await createNotification({
      userId: followedId,
      type: 'follower',
      title: 'Novo Seguidor!',
      message: `${followerName} começou a te seguir.`,
      fromId: followerId,
      fromName: followerName,
      fromPhoto: followerPhoto
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `followers/${followerId}_${followedId}`);
  }
};

export const unfollowUser = async (followerId: string, followedId: string) => {
  try {
    const followId = `${followerId}_${followedId}`;
    await deleteDoc(doc(db, "followers", followId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `followers/${followerId}_${followedId}`);
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
};

export const updateProfile = async (userId: string, data: { displayName?: string, bio?: string, photoURL?: string }) => {
  try {
    await updateDoc(doc(db, "users", userId), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
};

export const createPost = async (userId: string, userName: string, imageUrl: string, caption: string) => {
  try {
    await addDoc(collection(db, "posts"), {
      userId,
      userName,
      imageUrl,
      caption,
      likes: 0,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "posts");
  }
};

export const uploadFile = async (file: File, path: string) => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};

export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
};
