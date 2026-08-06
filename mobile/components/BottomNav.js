import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, styles } from '../lib/shared';
import { useAuth } from '../context/AuthContext';

const WEB_URL = 'https://invitavideos.com';

// A custom bottom bar. Three entries navigate to tab routes (Create, My Videos,
// Settings); "Open Web" is an action that doesn't map to a screen, which is
// why this is a hand-rolled bar rather than plain <Tab.Screen>s.
//
// Create is available to everyone, including guests (App Store Guideline
// 5.1.1(v) — rendering isn't account-based, so it can't require sign-in). My
// Videos and Settings navigate freely too; each screen shows its own "sign in"
// prompt for guests rather than being blocked at the tab bar.
export function BottomNav({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;

  const goTo = (routeName) => {
    const event = navigation.emit({ type: 'tabPress', target: routeName, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(routeName);
  };

  const Item = ({ icon, label, active, onPress }) => (
    <Pressable onPress={onPress} style={styles.tabItem} hitSlop={6}>
      <View style={[styles.tabPill, active && styles.tabPillActive]}>
        <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Item icon="✚" label="Create" active={activeRoute === 'CreateTab'} onPress={() => goTo('CreateTab')} />
      <Item icon="🎞️" label="My Videos" active={activeRoute === 'MyVideos'} onPress={() => goTo('MyVideos')} />
      <Item icon="⚙️" label="Settings" active={activeRoute === 'Settings'} onPress={() => goTo('Settings')} />
      <Item icon="🌐" label="Open Web" active={false} onPress={() => Linking.openURL(WEB_URL)} />
    </View>
  );
}
