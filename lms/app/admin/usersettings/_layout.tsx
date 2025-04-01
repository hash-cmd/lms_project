import { Stack } from 'expo-router';
import React from 'react';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AllUsers" />
      <Stack.Screen name="NewUser" />
      <Stack.Screen name="UserDetails" />
    </Stack>
  );
}
