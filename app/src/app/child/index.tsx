import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorState, Screen } from '@/components/Screen';
import { Pill, ProgressBar } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useMe } from '@/lib/auth';
import type { Chore, ChoreStatus } from '@/lib/types';
import { chunky, colors, fonts, radius, space } from '@/theme';

const statusBadge: Partial<Record<ChoreStatus, { text: string; bg: string; fg: string }>> = {
  InProgress: { text: 'Pågår', bg: colors.skySoft, fg: colors.ink },
  Submitted: { text: 'Väntar 👀', bg: colors.sunSoft, fg: colors.ink },
  Returned: { text: 'Kolla igen', bg: colors.coralSoft, fg: colors.coralDeep },
  Approved: { text: 'Klar ✓', bg: colors.mintSoft, fg: colors.mintDeep },
  Rejected: { text: 'Nekad', bg: colors.surfaceMuted, fg: colors.inkSoft },
};

export default function ChildHome() {
  const { id } = useMe();
  const { signOut } = useAuth();
  const today = useQuery({ queryKey: ['today', id], queryFn: () => api.today(id) });

  useFocusEffect(
    useCallback(() => {
      today.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  if (today.isPending) {
    return <Screen><ActivityIndicator color={colors.primary} /></Screen>;
  }
  if (today.isError) {
    return <Screen><ErrorState message={today.error.message} onRetry={() => today.refetch()} /></Screen>;
  }

  const { child, chores } = today.data;
  const open = chores.filter((c) => c.status !== 'Approved' && c.status !== 'Rejected');
  const done = chores.filter((c) => c.status === 'Approved' || c.status === 'Rejected');

  return (
    <Screen refreshing={today.isRefetching} onRefresh={today.refetch}>
      <LinearGradient colors={[child.color, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatar}>{child.avatar}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.hello}>Hej {child.name}!</Text>
            <Text style={styles.level}>Nivå {child.level}</Text>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <ProgressBar value={child.levelXp} max={child.levelXpMax} color={colors.sun} />
          <Text style={styles.xpText}>{child.levelXp} / {child.levelXpMax} XP till nästa nivå</Text>
        </View>
      </LinearGradient>

      <View style={styles.stats}>
        <View style={[styles.bank, chunky(colors.skySoft, 5)]}>
          <Text style={styles.bankLabel}>Din skärmtid</Text>
          <Text style={styles.bankValue}>{child.minutes}<Text style={styles.bankUnit}> min</Text></Text>
        </View>
        <View style={{ gap: 8, justifyContent: 'center' }}>
          <Pill icon="🪙" value={child.coins} bg={colors.sunSoft} fg={colors.ink} />
          <Pill icon="🔥" value={child.streak} label={child.streak === 1 ? 'dag' : 'dagar'} bg={colors.coralSoft} fg={colors.ink} />
        </View>
      </View>

      <Text style={styles.section}>Dagens uppdrag</Text>
      {open.length === 0 ? (
        <View style={styles.allDone}>
          <Text style={{ fontSize: 40 }}>🏆</Text>
          <Text style={styles.allDoneText}>Alla uppdrag klara idag!</Text>
        </View>
      ) : (
        open.map((c) => <QuestCard key={c.id} chore={c} />)
      )}

      {done.length > 0 ? (
        <>
          <Text style={styles.section}>Klart idag</Text>
          {done.map((c) => <QuestCard key={c.id} chore={c} />)}
        </>
      ) : null}

      <Pressable onPress={() => confirmSignOut(child.name, signOut)} accessibilityRole="button" style={styles.signOut}>
        <Text style={styles.signOutText}>Byt användare</Text>
      </Pressable>
    </Screen>
  );
}

function confirmSignOut(name: string, signOut: () => Promise<void>) {
  const message = `Logga ut ${name}? Du behöver din PIN för att komma in igen.`;
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) signOut();
    return;
  }
  Alert.alert('Byt användare', message, [
    { text: 'Avbryt', style: 'cancel' },
    { text: 'Logga ut', style: 'destructive', onPress: () => signOut() },
  ]);
}

function QuestCard({ chore }: { chore: Chore }) {
  const badge = statusBadge[chore.status];
  const finished = chore.status === 'Approved' || chore.status === 'Rejected';
  return (
    <Pressable
      disabled={finished}
      onPress={() => router.push({ pathname: '/child/chore/[id]', params: { id: chore.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${chore.title}, ${chore.minutes} minuter${badge ? `, ${badge.text}` : ''}`}
      style={({ pressed }) => [
        styles.quest,
        finished && { opacity: 0.6 },
        pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
      ]}
    >
      <View style={styles.questEmojiBox}>
        <Text style={styles.questEmoji}>{chore.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.questTitle}>{chore.title}</Text>
        <Text style={styles.questMeta}>
          ⏱️ {chore.minutes} min · ⭐ {chore.xp} · 🪙 {chore.coins}
          {chore.aiCheck ? '  · 🤖' : chore.requiresPhoto ? '  · 📸' : ''}
        </Text>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.text}</Text>
        </View>
      ) : (
        <Text style={styles.go}>›</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: space(5), gap: space(4) },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  avatarRing: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { fontSize: 46 },
  hello: { fontFamily: fonts.displayBold, fontSize: 28, color: '#fff' },
  level: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'rgba(255,255,255,0.92)' },
  xpText: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.92)' },
  stats: { flexDirection: 'row', gap: space(3) },
  bank: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space(4),
    borderWidth: 2, borderColor: colors.skySoft,
  },
  bankLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft },
  bankValue: { fontFamily: fonts.displayBold, fontSize: 44, color: colors.sky },
  bankUnit: { fontSize: 20, color: colors.inkSoft },
  section: { fontFamily: fonts.displayBold, fontSize: 21, color: colors.ink, marginTop: space(2) },
  quest: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space(3),
    borderWidth: 2, borderColor: colors.line, ...chunky(colors.line, 5),
  },
  questEmojiBox: {
    width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  questEmoji: { fontSize: 30 },
  questTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  questMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  go: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.primary, paddingHorizontal: 4 },
  signOut: { alignSelf: 'center', padding: space(3), marginTop: space(4) },
  signOutText: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, textDecorationLine: 'underline' },
  allDone: { alignItems: 'center', gap: space(2), padding: space(6), backgroundColor: colors.mintSoft, borderRadius: radius.lg },
  allDoneText: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.mintDeep },
});
