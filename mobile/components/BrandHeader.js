import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { styles } from '../lib/shared';
import { useAuth } from '../context/AuthContext';

export function BrandHeader() {
  const { user, signingIn, promptLogin, confirmSignOut } = useAuth();
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandPlate}>
        <Image source={require('../assets/logo-text.png')} style={styles.brandLogo} resizeMode="contain" />
      </View>
      {user ? (
        <Pressable onPress={confirmSignOut} style={styles.avatarChip} hitSlop={8}>
          <Text style={styles.avatarText}>{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</Text>
        </Pressable>
      ) : (
        <Pressable disabled={signingIn} onPress={promptLogin} style={[styles.headerGoogleButton, signingIn && styles.buttonDisabled]}>
          {signingIn ? <ActivityIndicator size="small" color="#1f1f1f" /> : <Text style={styles.googleG}>↪</Text>}
          <Text style={styles.headerGoogleText}>{signingIn ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
      )}
    </View>
  );
}
