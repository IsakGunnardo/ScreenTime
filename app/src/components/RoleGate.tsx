import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { colors } from '@/theme';

/** Släpper bara in rätt roll i en del av appen. Alla andra skickas till startskärmen. */
export function RoleGate({ role }: { role: Role }) {
  const { state } = useAuth();
  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (state.status !== 'signedIn' || state.me.role !== role) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
