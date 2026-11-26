import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, FormError } from '@/components/Field';
import { PinPad } from '@/components/PinPad';
import { Screen } from '@/components/Screen';
import { Body, Button, H1 } from '@/components/ui';
import { api } from '@/lib/api';
import { FAMILY_CODE_KEY, useAuth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import type { FamilyKid } from '@/lib/types';
import { chunky, colors, fonts, radius, space } from '@/theme';

/** Tre steg: familjekod → välj dig själv → PIN. */
export default function ChildLogin() {
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [family, setFamily] = useState<{ familyName: string; children: FamilyKid[] }>();
  const [kid, setKid] = useState<FamilyKid>();
  const [pin, setPin] = useState('');

  useEffect(() => {
    storage.get(FAMILY_CODE_KEY).then((c) => c && setCode(c));
  }, []);

  const lookup = useMutation({
    mutationFn: () => api.familyKids(code),
    onSuccess: async (f) => {
      setFamily(f);
      await storage.set(FAMILY_CODE_KEY, code);
    },
  });

  const login = useMutation({
    mutationFn: (p: string) => api.childLogin(code, kid!.id, p),
    onSuccess: async (res) => {
      await signIn(res);
      router.replace('/child');
    },
    onError: () => setPin(''),
  });

  // ---------- Steg 3: PIN ----------
  if (family && kid) {
    return (
      <Screen back>
        <Pressable onPress={() => { setKid(undefined); setPin(''); login.reset(); }} accessibilityRole="button">
          <Text style={styles.switch}>‹ Inte {kid.name}?</Text>
        </Pressable>
        <View style={styles.center}>
          <View style={[styles.avatarBig, { backgroundColor: kid.color }]}>
            <Text style={{ fontSize: 56 }}>{kid.avatar}</Text>
          </View>
          <H1 style={{ textAlign: 'center' }}>Hej {kid.name}!</H1>
          <Body style={{ textAlign: 'center' }}>Skriv din hemliga kod</Body>
        </View>
        <PinPad value={pin} onChange={setPin} onComplete={(p) => login.mutate(p)} busy={login.isPending} color={kid.color} />
        <FormError message={login.error?.message} />
      </Screen>
    );
  }

  // ---------- Steg 2: välj dig själv ----------
  if (family) {
    return (
      <Screen back>
        <Pressable onPress={() => setFamily(undefined)} accessibilityRole="button">
          <Text style={styles.switch}>‹ Byt familjekod</Text>
        </Pressable>
        <View style={styles.center}>
          <H1 style={{ textAlign: 'center' }}>Vem är du?</H1>
          <Body style={{ textAlign: 'center' }}>{family.familyName}</Body>
        </View>
        {family.children.length === 0 ? (
          <Body style={{ textAlign: 'center' }}>
            Inga barn är tillagda än. Be en förälder lägga till dig under Familj i sin app.
          </Body>
        ) : (
          <View style={styles.grid}>
            {family.children.map((k) => (
              <Pressable
                key={k.id}
                onPress={() => setKid(k)}
                accessibilityRole="button"
                accessibilityLabel={`Jag är ${k.name}`}
                style={({ pressed }) => [
                  styles.kid,
                  { backgroundColor: k.color, ...chunky('rgba(0,0,0,0.18)', pressed ? 1 : 6) },
                  pressed && { transform: [{ translateY: 5 }] },
                ]}
              >
                <Text style={{ fontSize: 60 }}>{k.avatar}</Text>
                <Text style={styles.kidName}>{k.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Screen>
    );
  }

  // ---------- Steg 1: familjekod ----------
  return (
    <Screen back footer={<Button label="Nästa" loading={lookup.isPending} disabled={code.length < 6} onPress={() => lookup.mutate()} />}>
      <View style={styles.center}>
        <Text style={{ fontSize: 56 }}>🏠</Text>
        <H1 style={{ textAlign: 'center' }}>Familjekod</H1>
        <Body style={{ textAlign: 'center' }}>Koden finns i din förälders app under Familj.</Body>
      </View>
      <Field
        label="Kod"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        style={styles.codeInput}
        onSubmitEditing={() => code.length === 6 && lookup.mutate()}
      />
      <FormError message={lookup.error?.message} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space(2), paddingTop: space(4) },
  switch: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.inkSoft },
  avatarBig: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4), justifyContent: 'center' },
  kid: { width: 140, aspectRatio: 0.9, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 4 },
  kidName: { fontFamily: fonts.displayBold, fontSize: 22, color: '#fff' },
  codeInput: {
    minHeight: 64, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface,
    fontFamily: fonts.displayBold, fontSize: 30, letterSpacing: 8, textAlign: 'center', color: colors.ink,
  },
});
