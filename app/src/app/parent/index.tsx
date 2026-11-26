import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AiVerdictCard } from '@/components/AiVerdictCard';
import { ErrorState, Screen } from '@/components/Screen';
import { Body, Button, Card, H1, RewardChips } from '@/components/ui';
import { api, photoSrc } from '@/lib/api';
import { useMe } from '@/lib/auth';
import type { QueueItem } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

export default function ParentQueue() {
  const me = useMe();
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue, refetchInterval: 4000 });
  const kids = useQuery({ queryKey: ['kids'], queryFn: api.children });
  const config = useQuery({ queryKey: ['config'], queryFn: api.config });

  return (
    <Screen refreshing={queue.isRefetching} onRefresh={queue.refetch}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.family}>{me.family.name}</Text>
          <H1>Hej {me.name}!</H1>
        </View>
        <Pressable
          onPress={() => router.push('/parent/family')}
          style={({ pressed }) => [styles.familyBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Familj och inställningar"
        >
          <Text style={{ fontSize: 22 }}>👨‍👩‍👧</Text>
          <Text style={styles.familyBtnText}>Familj</Text>
        </Pressable>
      </View>

      {kids.data?.length === 0 ? (
        <Card style={{ gap: space(3), backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Text style={styles.onboardTitle}>👋 Kom igång</Text>
          <Body>Lägg till dina barn. Varje barn får en egen PIN-kod och loggar in på sin enhet med familjekoden.</Body>
          <Button label="Lägg till barn" icon="➕" onPress={() => router.push('/parent/family')} />
        </Card>
      ) : null}

      {kids.data && kids.data.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3) }}>
          {kids.data.map((k) => (
            <View key={k.id} style={[styles.kidChip, { borderColor: k.color }]}>
              <Text style={{ fontSize: 26 }}>{k.avatar}</Text>
              <View>
                <Text style={styles.kidChipName}>{k.name}</Text>
                <Text style={styles.kidChipMeta}>⏱️ {k.minutes} min · 🔥 {k.streak}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ gap: space(1) }}>
        <Text style={styles.section}>Att godkänna</Text>
        {config.data ? (
          <Body>
            {config.data.aiEnabled
              ? '🤖 AI-koll är på. Den ger råd – du bestämmer alltid.'
              : '🤖 AI-koll är av. Lägg in din API-nyckel i backend för att slå på den.'}
          </Body>
        ) : null}
      </View>

      {queue.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      {queue.isError ? <ErrorState message={queue.error.message} onRetry={() => queue.refetch()} /> : null}

      {queue.data?.length === 0 && (kids.data?.length ?? 0) > 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>☕</Text>
          <Text style={styles.emptyTitle}>Inget att godkänna</Text>
          <Body style={{ textAlign: 'center' }}>Nya uppdrag dyker upp här automatiskt.</Body>
        </View>
      ) : null}

      {queue.data?.map((item) => <ApprovalCard key={item.chore.id} item={item} />)}
    </Screen>
  );
}

function ApprovalCard({ item }: { item: QueueItem }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const { chore } = item;

  const done = () => {
    qc.invalidateQueries({ queryKey: ['queue'] });
    qc.invalidateQueries({ queryKey: ['kids'] });
  };
  const approve = useMutation({ mutationFn: () => api.approve(chore.id), onSuccess: done });
  const sendBack = useMutation({ mutationFn: () => api.sendBack(chore.id, comment), onSuccess: done });
  const reject = useMutation({ mutationFn: () => api.reject(chore.id, comment), onSuccess: done });
  const busy = approve.isPending || sendBack.isPending || reject.isPending;
  const error = approve.error ?? sendBack.error ?? reject.error;

  const photo = photoSrc(chore.photoUrl);
  const time = chore.submittedAt
    ? new Date(chore.submittedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Card style={{ gap: space(3) }}>
      <View style={styles.row}>
        <Text style={{ fontSize: 34 }}>{item.childAvatar}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.childName}: {chore.title} {chore.emoji}</Text>
          <Text style={styles.meta}>Inskickad {time}</Text>
        </View>
      </View>

      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel={`Bevisbild för ${chore.title}`} />
      ) : (
        <View style={styles.noPhoto}><Text style={styles.meta}>Ingen bild bifogad</Text></View>
      )}

      {chore.aiCheck || chore.ai ? <AiVerdictCard ai={chore.ai} audience="parent" /> : null}
      <RewardChips minutes={chore.minutes} xp={chore.xp} coins={chore.coins} />

      {showComment ? (
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="T.ex. ”Nästan! Glasen står kvar”"
          placeholderTextColor={colors.inkSoft}
          style={styles.input}
          multiline
        />
      ) : null}

      {error ? <Text style={styles.error}>⚠️ {error.message}</Text> : null}

      <Button label="Godkänn" icon="✅" variant="mint" loading={approve.isPending} disabled={busy} onPress={() => approve.mutate()} />
      <View style={styles.row}>
        <Button
          label={showComment ? 'Skicka tillbaka' : 'Tillbaka'}
          icon="🔄"
          variant="ghost"
          style={{ flex: 1 }}
          loading={sendBack.isPending}
          disabled={busy}
          onPress={() => (showComment ? sendBack.mutate() : setShowComment(true))}
        />
        <Button label="Neka" variant="danger" style={{ flex: 1 }} loading={reject.isPending} disabled={busy} onPress={() => reject.mutate()} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingTop: space(2) },
  family: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft },
  familyBtn: {
    alignItems: 'center', paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line,
  },
  familyBtnText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  onboardTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.primaryDeep },
  section: { fontFamily: fonts.displayBold, fontSize: 21, color: colors.ink },
  kidChip: {
    flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2), paddingHorizontal: space(3),
    borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 2,
  },
  kidChipName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  kidChipMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  title: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  noPhoto: { padding: space(4), borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  input: {
    minHeight: 64, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, padding: space(3),
    fontFamily: fonts.body, fontSize: 16, color: colors.ink, backgroundColor: colors.bg,
  },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.coralDeep },
  empty: { alignItems: 'center', gap: space(2), paddingVertical: space(10) },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink },
});
