import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import your User-side screens
import UserHome from './UserHome';
import UserFilters from './UserFilters';
import UserSubmitReport from './UserSubmitReport';
import UserAccount from './UserAccount';

const Tab = createBottomTabNavigator();

export default function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // Clean look, icons only
        tabBarStyle: {
          backgroundColor: '#000', // Matches your black bottom bar theme
          height: 65,
          borderTopWidth: 0,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFB800', // Fuel Check Yellow
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          let iconSize = size + 4;

          if (route.name === 'UserHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'UserFilters') {
            iconName = focused ? 'options' : 'options-outline';
          } else if (route.name === 'UserSubmitReport') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
            iconSize = 30; // Make the "report" button stand out
          } else if (route.name === 'UserAccount') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
      })}
    >
      <Tab.Screen name="UserHome" component={UserHome} />
      <Tab.Screen name="UserFilters" component={UserFilters} />
      <Tab.Screen name="UserSubmitReport" component={UserSubmitReport} />
      <Tab.Screen name="UserAccount" component={UserAccount} />
    </Tab.Navigator>
  );
}