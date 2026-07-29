import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BrandHeader } from '../components/BrandHeader';
import { useAuth } from '../context/AuthContext';
import { palette, styles } from '../lib/shared';

export default function SettingsScreen() {
  const { user, promptLogin, confirmSignOut, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const runDelete = async () => {
    setError(''); setDeleting(true);
    try {
      await deleteAccount();
    } catch (e) {
      setError(e.message || 'Could not delete your account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your profile, videos and credit balance. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: runDelete },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <BrandHeader />

        <View style={styles.landingHero}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your account.</Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.confirmBody}>Sign in to manage your account.</Text>
            <Pressable onPress={promptLogin} style={styles.smallBtnPrimary}>
              <Text style={styles.smallBtnPrimaryText}>Sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>Name</Text>
                <Text style={styles.settingsValue} numberOfLines={1}>{user.name || '—'}</Text>
              </View>
              <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.settingsLabel}>Email</Text>
                <Text style={styles.settingsValue} numberOfLines={1}>{user.email || '—'}</Text>
              </View>
              <Pressable onPress={confirmSignOut} style={[styles.smallBtn, { marginTop: 14 }]}>
                <Text style={styles.smallBtnText}>Sign out</Text>
              </Pressable>
            </View>

            <View style={[styles.card, { marginTop: 16 }]}>
              <Text style={styles.sectionTitle}>Delete account</Text>
              <Text style={styles.confirmBody}>
                Permanently deletes your profile, saved videos and credit balance. This cannot be undone.
              </Text>
              <Pressable disabled={deleting} onPress={confirmDelete} style={[styles.smallBtnDanger, { marginTop: 14 }, deleting && styles.buttonDisabled]}>
                {deleting ? <ActivityIndicator color={palette.danger} size="small" /> : <Text style={styles.smallBtnDangerText}>Delete account</Text>}
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.footer}>InvitaVideos.com</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
