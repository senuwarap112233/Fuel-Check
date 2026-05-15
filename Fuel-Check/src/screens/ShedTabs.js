import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import your screens (Adjust paths as needed)
import ShedHome from './ShedHome';
import ShedSubmitReport from './ShedSubmitReport';
import ShedProfile from './ShedProfile';

const Tab = createBottomTabNavigator();

export default function ShedTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // Matches your screenshot (icons only)
        tabBarStyle: {
          backgroundColor: '#000', // Black background like screenshot
          height: 65,
          borderTopWidth: 0,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFB800', // Yellow for active tab
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          let iconSize = size + 4;

          if (route.name === 'ShedHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'ShedSubmitReport') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
            iconSize = 29; // Make the "+" button slightly larger
          } else if (route.name === 'ShedProfile') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          }

          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
      })}
    >
      <Tab.Screen name="ShedHome" component={ShedHome} />
  
      <Tab.Screen name="ShedSubmitReport" component={ShedSubmitReport} />
      <Tab.Screen name="ShedProfile" component={ShedProfile} />
    </Tab.Navigator>
  );
}