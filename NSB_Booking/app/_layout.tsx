// app/_layout.tsx  (ROOT layout)

import { Stack } from 'expo-router';
import { BookingDraftProvider } from './(context)/BookingDraftContext';

export default function RootLayout() {
  return (
    <BookingDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* First screen when app starts */}
        <Stack.Screen name="Splash" />

        {/* Sign in screen */}
        <Stack.Screen name="SignIn" />

        {/* Dashboards */}
        <Stack.Screen name="AdminDashboard" />
        <Stack.Screen name="ManagerDashboard" />
        <Stack.Screen name="UserDashboard" />

        {/* Your tab navigation group */}
        <Stack.Screen name="(tabs)" />
      </Stack>
    </BookingDraftProvider>
  );
}
