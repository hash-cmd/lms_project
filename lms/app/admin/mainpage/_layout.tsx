import { Stack } from 'expo-router';
import React from 'react';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" />
      <Stack.Screen name="AdminProjects" />
      <Stack.Screen name="AdminProjectDetail" />
      <Stack.Screen name="AdminNotifications" />
    </Stack>
  );
}
