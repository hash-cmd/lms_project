import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const AdminButtonPageTabs = () => {
  const { width } = Dimensions.get('window');
  const pathname = usePathname();
  const tabWidth = width / 5;

  const tabs = [
      { name: 'Home', icon: 'home', route: '/main/Dashboard' },
      { name: 'Projects', icon: 'briefcase', route: '/project/Projects' },
      { name: 'Tracker', icon: 'pulse', route: '/project/TrackAllProjects' },
      { name: 'Settings', icon: 'settings', route: '/main/Settings' },
  ];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const isActive = (route: string) => {
    return pathname === route || pathname.startsWith(route);
  };

  return (
    <LinearGradient
      colors={['#ffffff', '#f8f9fa']}
      style={styles.tabWrapper}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.route);
        return (
          <Link href={tab.route} asChild key={tab.route}>
            <TouchableOpacity 
              style={[styles.tabButton, { width: tabWidth }]}
              onPress={handlePress}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={tab.icon as any} 
                  size={24} 
                  color={active ? '#6a11cb' : '#9ca3af'}
                />
                {active && (
                  <LinearGradient
                    colors={['#6a11cb', '#2575fc']}
                    style={styles.underline}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                )}
              </View>
              <Text style={[
                styles.tabText,
                active && styles.activeText
              ]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          </Link>
        );
      })}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  tabWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  tabButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  underline: {
    height: 2,
    width: '80%',
    marginTop: 4,
    borderRadius: 1,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9ca3af',
  },
  activeText: {
    color: '#6a11cb',
    fontWeight: '600',
  },
});

export default AdminButtonPageTabs;