import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, styles } from '../lib/shared';
import { useAuth } from '../context/AuthContext';

const WEB_URL = 'https://invitavideos.com';

// A custom bottom bar. Two entries navigate to tab routes (Create, My Videos);
// two are actions (Login/Logout, Open in Web) that don't map to a screen, which
// is why this is a hand-rolled bar rather than plain <Tab.Screen>s.
export function BottomNav({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, confirmSignOut, signInWithGoogle } = useAuth();
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
      <Item
        icon={user ? '🚪' : '👤'}
        label={user ? 'Logout' : 'Login'}
        active={false}
        onPress={() => (user ? confirmSignOut() : signInWithGoogle())}
      />
      <Item icon="🌐" label="Open Web" active={false} onPress={() => Linking.openURL(WEB_URL)} />
    </View>
  );
}
