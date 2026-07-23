import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BrandHeader } from '../components/BrandHeader';
import { CATEGORY_ICONS, CATEGORY_TYPE_LABELS, json, styles } from '../lib/shared';

export default function LandingScreen({ navigation }) {
  const [categoryDefs, setCategoryDefs] = useState([]);

  useEffect(() => { json('/categories').then(setCategoryDefs).catch(() => {}); }, []);

  const categories = useMemo(
    () => (categoryDefs.length ? categoryDefs : [
      { id: 'wedding', name: 'Wedding', type: 'invitation', icon: '💍', description: 'Classic wedding invitation.' },
      { id: 'engagement', name: 'Engagement', type: 'invitation', icon: '💐', description: 'Engagement announcement.' },
      { id: 'birthday', name: 'Birthday', type: 'invitation', icon: '🎂', description: 'Birthday invitation.' },
    ]),
    [categoryDefs],
  );

  const categoriesByType = useMemo(() => {
    const groups = { invitation: [], personal: [] };
    categories.forEach((c) => { groups[c.type === 'invitation' ? 'invitation' : 'personal'].push(c); });
    return groups;
  }, [categories]);

  const openCategory = (category) => navigation.navigate('Create', { category: category.name });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <BrandHeader />

        <View style={styles.landingHero}>
          <Text style={styles.title}>What are you creating?</Text>
          <Text style={styles.subtitle}>Pick a category to start your video.</Text>
        </View>

        {['invitation', 'personal'].map((type) => (
          categoriesByType[type].length > 0 && (
            <View key={type} style={styles.typeSection}>
              <Text style={styles.typeSectionTitle}>{CATEGORY_TYPE_LABELS[type]}</Text>
              <View style={styles.categoryGrid}>
                {categoriesByType[type].map((category) => (
                  <Pressable key={category.id || category.name} onPress={() => openCategory(category)} style={styles.categoryCard}>
                    <Text style={styles.categoryCardIcon}>{category.icon || CATEGORY_ICONS[category.name] || '✨'}</Text>
                    <Text style={styles.categoryCardName}>{category.name}</Text>
                    <Text style={styles.categoryCardDesc} numberOfLines={2}>{category.description || ''}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        ))}

        <Text style={styles.footer}>InvitaVideos.com</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
