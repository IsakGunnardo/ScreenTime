import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Field, FormError } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Body, Button, Card, H1 } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useMe } from '@/lib/auth';
import type { ChildSummary } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

const AVATARS = ['🦊', '🐸', '🐼', '🦁', '🐯', '🐨', '🐙', '🦄', '🐲', '🐵', '🐧', '🦖'];
const COLORS = ['#FF8A5B', '#3DBE8B', '#3BA7FF', '#A66CFF', '#FF5C8A', '#F5B400'];

const isPin = (p: string) => /^\d{4}$/.test(p);

export default function FamilyScreen() {
  const me = useMe();
  const { signOut } = useAuth();
  const kids = useQuery({ queryKey: ['kids'], queryFn: api.children });
  const [adding, setAdding] = useState(false);
  const code = me.family.joinCode ?? '';

  return (
    <Screen back>
      <H1>{me.family.name}</H1>

      <Card style={{ gap: space(2), alignItems: 'center' }}>
        <Text style={styles.codeLabel}>Familjekod</Text>
        <Text style={styles.code} selectable accessibilityLabel={`Familjekod ${code.split('').join(' ')}`}>{code}</Text>
        <Body style={{ textAlign: 'center' }}>
          Barnen skriver in koden när de loggar in. Din partner använder den när hen skapar sitt konto.
        </Body>
        <Button
          label="Dela koden"
          icon="📤"
          variant="ghost"
          style={{ alignSelf: 'stretch' }}
          onPress={() => Share.share({ message: `Vår familjekod i ScreenTime: ${code}` }).catch(() => {})}
        />
      </Card>

      <Text style={styles.section}>Barn</Text>
      {kids.data?.map((k) => <KidRow key={k.id} kid={k} />)}
      {kids.data?.length === 0 && !adding ? <Body>Inga barn tillagda än.</Body> : null}

      {adding ? (
        <AddChildForm onDone={() => setAdding(false)} />
      ) : (
        <Button label="Lägg till barn" icon="➕" onPress={() => setAdding(true)} />
      )}

      <Pressable
        onPress={async () => {
          await signOut();
          router.replace('/');
        }}
        accessibilityRole="button"
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Logga ut</Text>
      </Pressable>
    </Screen>
  );
}

function KidRow({ kid }: { kid: ChildSummary }) {
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState('');
  const save = useMutation({
    mutationFn: () => api.setPin(kid.id, pin),
    onSuccess: () => {
      setEditing(false);
      setPin('');
    },
  });

  return (
    <Card style={{ gap: space(3) }}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: kid.color }]}>
          <Text style={{ fontSize: 28 }}>{kid.avatar}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kidName}>{kid.name}</Text>
          <Text style={styles.kidMeta}>
            Nivå {kid.level} · ⏱️ {kid.minutes} min · 🪙 {kid.coins} · 🔥 {kid.streak}
          </Text>
        </View>
        <Pressable onPress={() => setEditing((e) => !e)} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>{editing ? 'Avbryt' : 'Ny PIN'}</Text>
        </Pressable>
      </View>
      {editing ? (
        <>
          <Field
            label={`Ny PIN för ${kid.name}`}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="4 siffror"
          />
          <FormError message={save.error?.message} />
          <Button label="Spara PIN" variant="mint" disabled={!isPin(pin)} loading={save.isPending} onPress={() => save.mutate()} />
        </>
      ) : null}
      {save.isSuccess && !editing ? <Text style={styles.saved}>✓ PIN uppdaterad</Text> : null}
    </Card>
  );
}

function AddChildForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [pin, setPin] = useState('');

  const add = useMutation({
    mutationFn: () => api.addChild({ name, avatar, color, pin }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kids'] });
      onDone();
    },
  });

  return (
    <Card style={{ gap: space(4) }}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: color, width: 64, height: 64, borderRadius: 32 }]}>
          <Text style={{ fontSize: 36 }}>{avatar}</Text>
        </View>
        <Text style={[styles.kidName, { flex: 1 }]}>{name || 'Nytt barn'}</Text>
      </View>

      <Field label="Namn" value={name} onChangeText={setName} placeholder="T.ex. Elsa" maxLength={30} />

      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>Avatar</Text>
        <View style={styles.wrap}>
          {AVATARS.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAvatar(a)}
              accessibilityRole="radio"
              accessibilityState={{ selected: a === avatar }}
              style={[styles.choice, a === avatar && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
            >
              <Text style={{ fontSize: 26 }}>{a}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>Färg</Text>
        <View style={styles.wrap}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityLabel={`Färg ${c}`}
              accessibilityState={{ selected: c === color }}
              style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}
            />
          ))}
        </View>
      </View>

      <Field
        label="PIN-kod"
        value={pin}
        onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="4 siffror"
        hint="Barnet använder koden för att logga in. Du kan byta den senare."
      />

      <FormError message={add.error?.message} />
      <Button label="Spara" variant="mint" disabled={!name.trim() || !isPin(pin)} loading={add.isPending} onPress={() => add.mutate()} />
      <Button label="Avbryt" variant="ghost" onPress={onDone} />
    </Card>
  );
}

const styles = StyleSheet.create({
  codeLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft },
  code: { fontFamily: fonts.displayBold, fontSize: 42, letterSpacing: 8, color: colors.primary },
  section: { fontFamily: fonts.displayBold, fontSize: 21, color: colors.ink, marginTop: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  kidName: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink },
  kidMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  link: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primary },
  saved: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.mintDeep },
  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  choice: {
    width: 50, height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface,
  },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.ink },
  signOut: { alignSelf: 'center', padding: space(3), marginTop: space(6) },
  signOutText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.coralDeep },
});
