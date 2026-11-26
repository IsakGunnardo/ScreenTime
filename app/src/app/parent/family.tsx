import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
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
        <ChildForm onDone={() => setAdding(false)} />
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

  if (editing) return <ChildForm kid={kid} onDone={() => setEditing(false)} />;

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
        <Pressable
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel={`Redigera ${kid.name}`}
          hitSlop={8}
          style={styles.editBtn}
        >
          <Text style={styles.link}>✏️ Ändra</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function confirmDelete(name: string, onYes: () => void) {
  const message = `Ta bort ${name}? Alla uppdrag, all intjänad tid och alla bilder för ${name} raderas. Det går inte att ångra.`;
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) onYes();
    return;
  }
  Alert.alert('Ta bort barn', message, [
    { text: 'Avbryt', style: 'cancel' },
    { text: 'Ta bort', style: 'destructive', onPress: onYes },
  ]);
}

/** Används både för att lägga till (utan kid) och redigera (med kid). */
function ChildForm({ kid, onDone }: { kid?: ChildSummary; onDone: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!kid;
  const [name, setName] = useState(kid?.name ?? '');
  const [avatar, setAvatar] = useState(kid?.avatar ?? AVATARS[0]);
  const [color, setColor] = useState(kid?.color ?? COLORS[0]);
  const [pin, setPin] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['kids'] });
    qc.invalidateQueries({ queryKey: ['queue'] });
    onDone();
  };

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? api.updateChild(kid.id, { name, avatar, color, pin: pin || undefined })
        : api.addChild({ name, avatar, color, pin }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: () => api.deleteChild(kid!.id), onSuccess: refresh });

  const pinOk = isEdit ? pin === '' || isPin(pin) : isPin(pin);
  // Visa även avatarer som inte finns i listan (t.ex. sparade tidigare).
  const avatarChoices = AVATARS.includes(avatar) ? AVATARS : [avatar, ...AVATARS];

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
          {avatarChoices.map((a) => (
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
        label={isEdit ? 'Ny PIN-kod (valfritt)' : 'PIN-kod'}
        value={pin}
        onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="4 siffror"
        hint={isEdit ? 'Lämna tomt för att behålla nuvarande PIN.' : 'Barnet använder koden för att logga in. Du kan byta den senare.'}
      />

      <FormError message={save.error?.message ?? remove.error?.message} />
      <Button
        label={isEdit ? 'Spara ändringar' : 'Spara'}
        variant="mint"
        disabled={!name.trim() || !pinOk || remove.isPending}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
      <Button label="Avbryt" variant="ghost" disabled={save.isPending || remove.isPending} onPress={onDone} />
      {isEdit ? (
        <Button
          label={`Ta bort ${kid.name}`}
          icon="🗑️"
          variant="danger"
          loading={remove.isPending}
          disabled={save.isPending}
          onPress={() => confirmDelete(kid.name, () => remove.mutate())}
        />
      ) : null}
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
  editBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
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
