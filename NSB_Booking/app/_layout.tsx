// app/_layout.tsx  (ROOT layout)
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
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
  );
}
