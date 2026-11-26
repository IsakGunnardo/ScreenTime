import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, FormError } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Body, Button, H1 } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AuthResponse } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

type Mode = 'login' | 'register';

export default function ParentLogin() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const done = async (res: AuthResponse) => {
    await signIn(res);
    router.replace('/parent');
  };

  const login = useMutation({ mutationFn: () => api.login(email, password), onSuccess: done });
  const register = useMutation({
    mutationFn: () =>
      api.register({
        name, email, password,
        familyName: joining ? undefined : familyName || undefined,
        joinCode: joining ? joinCode : undefined,
      }),
    onSuccess: done,
  });
  const active = mode === 'login' ? login : register;

  return (
    <Screen
      back
      footer={
        <Button
          label={mode === 'login' ? 'Logga in' : joining ? 'Gå med i familjen' : 'Skapa konto'}
          loading={active.isPending}
          onPress={() => active.mutate()}
        />
      }
    >
      <View style={{ gap: space(1) }}>
        <H1>{mode === 'login' ? 'Välkommen tillbaka' : 'Skapa föräldrakonto'}</H1>
        <Body>
          {mode === 'login'
            ? 'Logga in för att godkänna uppdrag och hantera familjen.'
            : 'Du får en familjekod som barnen använder för att logga in.'}
        </Body>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['login', 'register'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            style={[styles.tab, mode === m && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
              {m === 'login' ? 'Logga in' : 'Nytt konto'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'register' ? (
        <Field label="Ditt namn" value={name} onChangeText={setName} placeholder="T.ex. Isak" autoComplete="name" />
      ) : null}
      <Field
        label="E-post"
        value={email}
        onChangeText={setEmail}
        placeholder="namn@exempel.se"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        label="Lösenord"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        textContentType={mode === 'login' ? 'password' : 'newPassword'}
        hint={mode === 'register' ? 'Minst 8 tecken' : undefined}
        onSubmitEditing={() => mode === 'login' && login.mutate()}
      />

      {mode === 'register' ? (
        <>
          <Pressable
            onPress={() => setJoining((j) => !j)}
            style={styles.toggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: joining }}
          >
            <View style={[styles.box, joining && styles.boxOn]}>
              {joining ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={styles.toggleText}>Min partner har redan skapat familjen</Text>
          </Pressable>
          {joining ? (
            <Field
              label="Familjekod"
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="T.ex. K7QP3X"
              autoCapitalize="characters"
              maxLength={6}
              hint="Finns under Familj i din partners app."
            />
          ) : (
            <Field label="Familjens namn (valfritt)" value={familyName} onChangeText={setFamilyName} placeholder="T.ex. Familjen Gunnardo" />
          )}
        </>
      ) : null}

      <FormError message={active.error?.message} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.inkSoft },
  tabTextActive: { color: colors.ink },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1) },
  box: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 15 },
  toggleText: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, flex: 1 },
});
