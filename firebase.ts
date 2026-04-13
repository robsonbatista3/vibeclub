import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD9RFwfzhEKQwhFm0eRNNJEUMgg7xS9LPo",
  authDomain: "vibeclub-77b10.firebaseapp.com",
  projectId: "vibeclub-77b10",
  storageBucket: "vibeclub-77b10.firebasestorage.app",
  messagingSenderId: "828613035269",
  appId: "1:828613035269:web:346b5525c792196d38a36c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
