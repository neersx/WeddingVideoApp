import React, { createContext, useContext, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { DISABLE_GOOGLE_AUTH, isCredentialExpired, json } from '../lib/shared';

// expo-apple-authentication calls its native module at import time and only
// exists on iOS, so require it lazily on iOS to avoid crashing web/Android.
const AppleAuthentication = Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DISABLE_GOOGLE_AUTH ? { email: 'local-dev@invitavideos.test', name: 'Local Development User' } : null);
  // `credential` is now a first-party session JWT returned by the backend after
  // verifying either Google or Apple — used as the Bearer on every request.
  const [credential, setCredential] = useState(DISABLE_GOOGLE_AUTH ? 'local-development' : null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [loginVisible, setLoginVisible] = useState(false);

  const promptLogin = () => { setError(''); setLoginVisible(true); };
  const closeLogin = () => setLoginVisible(false);

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
      setCredential(data.token || null);
      setLoginVisible(false);
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return;
      setError(e.message || 'Google sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  }

  async function signInWithApple() {
    if (!AppleAuthentication) return setError('Sign in with Apple is only available on iOS.');
    setError(''); setSigningIn(true);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const identityToken = cred.identityToken;
      if (!identityToken) return setError('Apple did not return an identity token.');
      const fullName = cred.fullName
        ? [cred.fullName.givenName, cred.fullName.familyName].filter(Boolean).join(' ')
        : '';
      const data = await json('/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityToken, fullName, email: cred.email || '' }),
      });
      setUser(data.user || data);
      setCredential(data.token || null);
      setLoginVisible(false);
    } catch (e) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; // user dismissed the sheet
      setError(e.message || 'Apple sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    if (DISABLE_GOOGLE_AUTH) return;
    try { await GoogleSignin.signOut(); } catch (e) { /* still clear local state below */ }
    setUser(null);
    setCredential(null);
  }

  function confirmSignOut() {
    if (DISABLE_GOOGLE_AUTH) return;
    Alert.alert('Sign out?', user?.email ? `Signed in as ${user.email}` : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  // Return a currently-valid session token. Session JWTs last ~30 days; if the
  // stored one is missing/expired we try to silently re-establish it via Google
  // (Apple can't refresh silently — those users re-tap Sign in with Apple).
  async function ensureValidCredential() {
    if (DISABLE_GOOGLE_AUTH) return credential || 'local-development';
    if (credential && !isCredentialExpired(credential)) return credential;
    try {
      const result = await GoogleSignin.signInSilently();
      if (isSuccessResponse(result) && result.data?.idToken) {
        const data = await json('/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: result.data.idToken }) });
        setUser(data.user || data);
        setCredential(data.token || null);
        return data.token || null;
      }
    } catch (e) {
      // No silent Google session to restore — fall through to signed-out.
    }
    setUser(null);
    setCredential(null);
    return null;
  }

  const value = { user, credential, signingIn, error, setError, signInWithGoogle, signInWithApple, confirmSignOut, ensureValidCredential, promptLogin, closeLogin, loginVisible };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
