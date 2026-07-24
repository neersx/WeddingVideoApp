import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from 'react-native';
import { palette, styles } from '../lib/shared';
import { useAuth } from '../context/AuthContext';

// iOS-only native module; require lazily so web/Android don't crash on import.
const AppleAuthentication = Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

export function LoginModal() {
  const { loginVisible, closeLogin, signInWithGoogle, signInWithApple, signingIn, error } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (AppleAuthentication) {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  return (
    <Modal visible={loginVisible} transparent animationType="slide" onRequestClose={closeLogin}>
      <Pressable style={styles.loginBackdrop} onPress={closeLogin}>
        <Pressable style={styles.loginSheet} onPress={() => {}}>
          <View style={styles.loginHandle} />
          <Text style={styles.loginTitle}>Sign in to InvitaVideos</Text>
          <Text style={styles.loginSubtitle}>Create, save and share your videos.</Text>

          <Pressable disabled={signingIn} onPress={signInWithGoogle} style={[styles.googleBtn, signingIn && styles.buttonDisabled]}>
            <Text style={styles.googleBtnG}>G</Text>
            <Text style={styles.googleBtnText}>Sign in with Google</Text>
          </Pressable>

          {AppleAuthentication && appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={14}
              style={styles.appleBtn}
              onPress={signInWithApple}
            />
          ) : null}

          {signingIn ? (
            <View style={styles.loginBusy}>
              <ActivityIndicator color={palette.gold} />
              <Text style={styles.loginBusyText}>Signing in…</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.loginError}>{error}</Text> : null}

          <Pressable onPress={closeLogin} style={styles.loginCancel} hitSlop={8}>
            <Text style={styles.loginCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
