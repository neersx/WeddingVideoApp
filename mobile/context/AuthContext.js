import React, { createContext, useContext, useState } from 'react';
import { Alert, Dimensions, Platform } from 'react-native';
import { GoogleSignin, isSuccessResponse, isCancelledResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { DISABLE_GOOGLE_AUTH, isCredentialExpired, json } from '../lib/shared';

// expo-apple-authentication calls its native module at import time and only
// exists on iOS, so require it lazily on iOS to avoid crashing web/Android.
const AppleAuthentication = Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

const AuthContext = createContext(null);

// Reported to the backend as `lastLoggedInSource` — support/diagnostics only,
// never trusted for anything security-relevant server-side. `Platform.isPad`
// is the standard RN signal for iPhone vs iPad (works on real devices and
// simulators alike); Android has no equivalent flag, so fall back to the same
// smallest-width >= 600dp heuristic Android itself uses for its sw600dp
// tablet resource qualifier.
function loginSource() {
  if (Platform.OS === 'ios') return Platform.isPad ? 'iPad' : 'iOS Phone';
  if (Platform.OS === 'android') {
    const { width, height } = Dimensions.get('window');
    return Math.min(width, height) >= 600 ? 'Android Tablet' : 'Android Phone';
  }
  if (Platform.OS === 'web') return 'Web';
  return 'Unknown';
}

// expo-apple-authentication relays Apple's own wording, which is opaque to a
// user and unactionable in a bug report ("The authorization attempt failed for
// an unknown reason" is ASAuthorizationError.unknown / code 1000 — Apple gives
// no further detail). Translate the codes into something a tester can act on,
// and keep the raw code visible so TestFlight reports identify the failure.
function appleSignInMessage(e) {
  const code = e?.code || '';
  const hint = {
    // 1000. Almost always the device's Apple Account: signed out of iCloud, or
    // the account can't complete the request. Also what a build whose
    // provisioning profile lacks the Sign in with Apple entitlement reports.
    ERR_REQUEST_UNKNOWN:
      'Apple could not complete the sign-in. Check that you are signed in to iCloud in Settings, then try again.',
    ERR_REQUEST_NOT_HANDLED: 'Apple could not handle the sign-in request. Please try again.',
    ERR_REQUEST_NOT_INTERACTIVE: 'Apple sign-in needs to be started from the app. Please try again.',
    ERR_REQUEST_FAILED: 'Apple sign-in failed. Please try again.',
    ERR_INVALID_RESPONSE: 'Apple returned an unexpected response. Please try again.',
  }[code];
  if (hint) return code ? `${hint} (${code})` : hint;
  return [e?.message || 'Apple sign-in failed.', code && `(${code})`].filter(Boolean).join(' ');
}

// Surfaces an auth failure two ways: the inline error text in LoginModal (easy
// to miss if the sheet is mid-dismiss) and a native Alert (impossible to miss,
// works identically on iOS/Android). Also logs to the console so `adb logcat`
// / Metro output has the raw error for debugging silent native-SDK failures.
function reportAuthError(setError, message, raw) {
  if (raw) console.error('[auth]', message, raw);
  setError(message);
  Alert.alert('Sign-in failed', message);
}

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
      if (isCancelledResponse(result)) return; // user backed out of the picker — not an error
      if (!isSuccessResponse(result)) {
        // e.g. 'noSavedCredentialFound' — a real dead end (no Google account on
        // the device to pick), previously swallowed silently.
        reportAuthError(setError, 'No Google account is available to sign in with. Add one in your device settings and try again.', result);
        return;
      }
      const token = result.data?.idToken;
      if (!token) return reportAuthError(setError, 'Google did not return an ID token. Check your Google client IDs.', result);
      const data = await json('/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: token, source: loginSource() }) });
      setUser(data.user || data);
      setCredential(data.token || null);
      setLoginVisible(false);
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return;
      reportAuthError(setError, e.message || 'Google sign-in failed.', e);
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
      if (!identityToken) return reportAuthError(setError, 'Apple did not return an identity token.', cred);
      const fullName = cred.fullName
        ? [cred.fullName.givenName, cred.fullName.familyName].filter(Boolean).join(' ')
        : '';
      const data = await json('/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityToken, fullName, email: cred.email || '', source: loginSource() }),
      });
      setUser(data.user || data);
      setCredential(data.token || null);
      setLoginVisible(false);
    } catch (e) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; // user dismissed the sheet
      reportAuthError(setError, appleSignInMessage(e), e);
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

  // Permanently erases the account server-side (profile, renders, wallet) —
  // required by App Store Guideline 5.1.1(v): account deletion must be
  // reachable in-app, not just a sign-out/deactivate.
  async function deleteAccount() {
    const cred = await ensureValidCredential();
    if (!cred) throw new Error('You need to be signed in to delete your account.');
    await json('/account', { method: 'DELETE', headers: { Authorization: `Bearer ${cred}` } });
    setUser(null);
    setCredential(null);
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
        const data = await json('/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: result.data.idToken, source: loginSource() }) });
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

  const value = { user, credential, signingIn, error, setError, signInWithGoogle, signInWithApple, confirmSignOut, deleteAccount, ensureValidCredential, promptLogin, closeLogin, loginVisible };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
