import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider } from './context/AuthContext';
import { BottomNav } from './components/BottomNav';
import LandingScreen from './screens/LandingScreen';
import CreateScreen from './screens/CreateScreen';
import MyDownloadsScreen from './screens/MyDownloadsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// The "Create Video" tab is itself a stack: category picker (Landing) → wizard
// (Create). Keeping it nested means the wizard pushes over the picker without
// leaving the tab.
function CreateStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Create" component={CreateScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <BottomNav {...props} />}
        >
          <Tab.Screen name="CreateTab" component={CreateStack} />
          <Tab.Screen name="MyVideos" component={MyDownloadsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
