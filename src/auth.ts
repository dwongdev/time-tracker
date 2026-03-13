import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, sendEmailVerification  } from "firebase/auth"
import { auth } from "./firebase";

export const signUp = async (email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Send email verification immediately after signup
    await sendEmailVerification(userCredential.user);
    return userCredential;
};

export const signIn = (email: string, password:string) => {
    return signInWithEmailAndPassword(auth, email, password);
};

export const signOutUser = () => {
    return signOut(auth)
};

export const googleSignIn = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
}

export const resetPassword = (email: string) => {
    return sendPasswordResetEmail(auth, email);
}

export const resendVerificationEmail = async () => {
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
        return sendEmailVerification(user);
    }
    throw new Error('No user signed in or email already verified');
}