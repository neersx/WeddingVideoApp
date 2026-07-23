import React, { createContext, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { DISABLE_GOOGLE_AUTH, isCredentialExpired, json } from '../lib/shared';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DISABLE_GOOGLE_AUTH ? { email: 'local-dev@invitavideos.test', name: 'Local Development User' } : null);
  const [credential, setCredential] = useState(DISABLE_GOOGLE_AUTH ? 'local-development' : null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  async function signInWithGoogle() {
    setError(''); setSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return; // user cancelled
      const token = result.data?.idToken;
      if (!token) return setError('Google did not return an ID token. Check your Google client IDs.');
      const data = await json('/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: token }) });
      setUser(data.user || data);
      setCredential(token);
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return;
      setError(e.message || 'Google sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  }

  async function signOutOfGoogle() {
    if (DISABLE_GOOGLE_AUTH) return;
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore — we still clear local state below so the UI reflects signed-out.
    }
    setUser(null);
    setCredential(null);
  }

  function confirmSignOut() {
    if (DISABLE_GOOGLE_AUTH) return;
    Alert.alert('Sign out?', user?.email ? `Signed in as ${user.email}` : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOutOfGoogle },
    ]);
  }

  // Return a currently-valid credential, refreshing silently if the stored one
  // expired. Returns null if the session can't be restored without a full sign-in.
  async function ensureValidCredential() {
    if (DISABLE_GOOGLE_AUTH) return credential || 'local-development';
    if (credential && !isCredentialExpired(credential)) return credential;
    try {
      const result = await GoogleSignin.signInSilently();
      if (isSuccessResponse(result) && result.data?.idToken) {
        const token = result.data.idToken;
        const data = await json('/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: token }) });
        setUser(data.user || data);
        setCredential(token);
        return token;
      }
    } catch (e) {
      // No valid Google session to refresh from — fall through to signed-out.
    }
    // Clear the stale session so the UI reflects signed-out. Form state is kept.
    setUser(null);
    setCredential(null);
    return null;
  }

  const value = { user, credential, signingIn, error, setError, signInWithGoogle, confirmSignOut, ensureValidCredential };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
