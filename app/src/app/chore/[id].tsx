import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AiVerdictCard } from '@/components/AiVerdictCard';
import { Confetti } from '@/components/Confetti';
import { ErrorState, Screen } from '@/components/Screen';
import { Body, Button, Card, H1, RewardChips } from '@/components/ui';
import { api, photoSrc } from '@/lib/api';
import { capturePhoto } from '@/lib/camera';
import type { Chore } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

export default function ChoreScreen() {
  const { id, childId } = useLocalSearchParams<{ id: string; childId: string }>();
  const qc = useQueryClient();
  const [localUri, setLocalUri] = useState<string>();
  const [error, setError] = useState<string>();

  const chore = useQuery({
    queryKey: ['chore', id],
    queryFn: () => api.chore(id),
    // Väntar vi på förälder? Fråga servern var 3:e sekund. (Byts mot SignalR i nästa steg.)
    refetchInterval: (q) => (q.state.data?.status === 'Submitted' ? 3000 : false),
  });

  const update = (c: Chore) => {
    qc.setQueryData(['chore', id], c);
    qc.invalidateQueries({ queryKey: ['today', childId] });
    setError(undefined);
  };
  const onError = (e: Error) => setError(e.message);

  const start = useMutation({ mutationFn: () => api.start(id), onSuccess: update, onError });
  const submit = useMutation({ mutationFn: () => api.submit(id), onSuccess: update, onError });
  const upload = useMutation({
    mutationFn: (uri: string) => api.uploadPhoto(id, uri),
    onSuccess: (c) => {
      update(c);
      Haptics.notificationAsync(
        c.ai && !c.ai.complete ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    },
    onError: (e: Error) => {
      setLocalUri(undefined);
      onError(e);
    },
  });

  // Firande-haptik när godkännandet kommer in.
  const prevStatus = useRef<string>(undefined);
  useEffect(() => {
    const s = chore.data?.status;
    if (prevStatus.current === 'Submitted' && s === 'Approved') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    prevStatus.current = s;
  }, [chore.data?.status]);

  const takePhoto = async () => {
    setError(undefined);
    try {
      const shot = await capturePhoto();
      if (!shot) return;
      if ('error' in shot) return setError(shot.error);
      setLocalUri(shot.uri);
      upload.mutate(shot.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte öppna kameran');
    }
  };

  if (chore.isPending) return <Screen back><ActivityIndicator color={colors.primary} /></Screen>;
  if (chore.isError) return <Screen back><ErrorState message={chore.error.message} onRetry={() => chore.refetch()} /></Screen>;

  const c = chore.data;
  const shownPhoto = localUri ?? photoSrc(c.photoUrl);
  const hasPhoto = !!c.photoUrl;

  // ---------- Godkänd: firande ----------
  if (c.status === 'Approved') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Screen
          footer={<Button label="Till mina uppdrag" variant="primary" onPress={() => router.back()} />}
        >
          <View style={styles.celebrate}>
            <Text style={styles.bigEmoji}>🎉</Text>
            <H1 style={{ textAlign: 'center' }}>Snyggt jobbat!</H1>
            <Body style={{ textAlign: 'center' }}>”{c.title}” är godkänd. Det här har du tjänat:</Body>
          </View>
          <View style={styles.rewardRow}>
            <Reward icon="⏱️" value={`+${c.minutes}`} label="minuter" bg={colors.skySoft} />
            <Reward icon="⭐" value={`+${c.xp}`} label="XP" bg={colors.primarySoft} />
            <Reward icon="🪙" value={`+${c.coins}`} label="mynt" bg={colors.sunSoft} />
          </View>
        </Screen>
        <Confetti />
      </View>
    );
  }

  // ---------- Väntar på förälder ----------
  if (c.status === 'Submitted') {
    return (
      <Screen back footer={<Button label="Gör ett annat uppdrag" variant="ghost" onPress={() => router.back()} />}>
        <View style={styles.celebrate}>
          <Pulse>⏳</Pulse>
          <H1 style={{ textAlign: 'center' }}>Skickat!</H1>
          <Body style={{ textAlign: 'center' }}>
            Nu kollar en förälder. Du kan göra fler uppdrag under tiden – den här sidan uppdateras av sig själv.
          </Body>
        </View>
        {shownPhoto ? <Image source={{ uri: shownPhoto }} style={styles.photoSmall} /> : null}
        <RewardChips minutes={c.minutes} xp={c.xp} coins={c.coins} />
      </Screen>
    );
  }

  // ---------- Nekad ----------
  if (c.status === 'Rejected') {
    return (
      <Screen back>
        <View style={styles.celebrate}>
          <Text style={styles.bigEmoji}>🙈</Text>
          <H1 style={{ textAlign: 'center' }}>Inte den här gången</H1>
          {c.parentComment ? <Body style={{ textAlign: 'center' }}>”{c.parentComment}”</Body> : null}
        </View>
      </Screen>
    );
  }

  // ---------- Ej startad / tillbakaskickad / pågår ----------
  const inProgress = c.status === 'InProgress';
  const checking = upload.isPending;
  const canSubmit = inProgress && !checking && (!c.requiresPhoto || hasPhoto);

  let footer;
  if (!inProgress) {
    footer = (
      <Button
        label={c.status === 'Returned' ? 'Fixa och försök igen' : 'Starta uppdraget'}
        icon="🚀"
        loading={start.isPending}
        onPress={() => start.mutate()}
      />
    );
  } else {
    footer = (
      <>
        {hasPhoto || !c.requiresPhoto ? (
          <Button
            label={c.ai && !c.ai.complete ? 'Skicka ändå' : 'Skicka till förälder'}
            icon="✅"
            variant="mint"
            disabled={!canSubmit}
            loading={submit.isPending}
            onPress={() => submit.mutate()}
          />
        ) : null}
        {hasPhoto ? <Button label="Ta ny bild" icon="📸" variant="ghost" disabled={checking} onPress={takePhoto} /> : null}
      </>
    );
  }

  return (
    <Screen back footer={footer}>
      <View style={styles.head}>
        <View style={styles.emojiBadge}>
          <Text style={styles.headEmoji}>{c.emoji}</Text>
        </View>
        <H1 style={{ textAlign: 'center' }}>{c.title}</H1>
        {c.hint ? <Body style={{ textAlign: 'center' }}>💡 {c.hint}</Body> : null}
        <RewardChips minutes={c.minutes} xp={c.xp} coins={c.coins} />
      </View>

      {c.status === 'Returned' && c.parentComment ? (
        <Card style={{ backgroundColor: colors.coralSoft, borderColor: colors.coralSoft }}>
          <Text style={styles.noteTitle}>Meddelande från förälder</Text>
          <Text style={styles.noteText}>”{c.parentComment}”</Text>
        </Card>
      ) : null}

      {inProgress && (c.requiresPhoto || hasPhoto) ? (
        <View style={{ gap: space(3) }}>
          <Text style={styles.stepTitle}>
            {c.requiresPhoto ? 'Fota när du är klar' : 'Bild (valfri)'}
          </Text>
          {!checking ? <AiVerdictCard ai={c.ai} audience="child" /> : null}
          {shownPhoto ? (
            <View>
              <Image source={{ uri: shownPhoto }} style={styles.photo} accessibilityLabel="Din bild" />
              {checking ? (
                <View style={styles.scanOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={styles.scanText}>{c.aiCheck ? 'Robo-kollar din bild…' : 'Laddar upp…'}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable onPress={takePhoto} style={styles.photoEmpty} accessibilityRole="button" accessibilityLabel="Ta bild">
              <Text style={{ fontSize: 44 }}>📸</Text>
              <Text style={styles.photoEmptyTitle}>Tryck för att ta en bild</Text>
              <Text style={styles.photoEmptySub}>
                {c.aiCheck ? 'Vår robot tittar direkt och säger om något saknas.' : 'Bilden visas för din förälder.'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {inProgress && !c.requiresPhoto && !hasPhoto ? (
        <Pressable onPress={takePhoto} accessibilityRole="button">
          <Text style={styles.optionalPhoto}>📸 Lägg till en bild (valfritt)</Text>
        </Pressable>
      ) : null}

      {error ? (
        <View style={styles.error} accessibilityLiveRegion="assertive">
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

function Reward({ icon, value, label, bg }: { icon: string; value: string; label: string; bg: string }) {
  return (
    <View style={[styles.reward, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 30 }}>{icon}</Text>
      <Text style={styles.rewardValue}>{value}</Text>
      <Text style={styles.rewardLabel}>{label}</Text>
    </View>
  );
}

function Pulse({ children }: { children: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  return <Animated.Text style={[styles.bigEmoji, { transform: [{ scale }] }]}>{children}</Animated.Text>;
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: space(3), paddingTop: space(2) },
  emojiBadge: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.line,
  },
  headEmoji: { fontSize: 60 },
  stepTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink },
  photo: { width: '100%', height: 300, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  photoSmall: { width: '60%', aspectRatio: 3 / 4, alignSelf: 'center', borderRadius: radius.md },
  scanOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.lg, backgroundColor: 'rgba(43,34,56,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: space(3),
  },
  scanText: { fontFamily: fonts.bodyBold, fontSize: 17, color: '#fff' },
  photoEmpty: {
    alignItems: 'center', gap: space(2), padding: space(8), borderRadius: radius.lg,
    borderWidth: 3, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primarySoft,
  },
  photoEmptyTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.primaryDeep },
  photoEmptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  optionalPhoto: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.primary, textAlign: 'center', padding: space(2) },
  noteTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.coralDeep },
  noteText: { fontFamily: fonts.body, fontSize: 17, color: colors.ink, marginTop: 4 },
  error: { backgroundColor: colors.coralSoft, padding: space(3), borderRadius: radius.md },
  errorText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.coralDeep },
  celebrate: { alignItems: 'center', gap: space(3), paddingTop: space(10) },
  bigEmoji: { fontSize: 84, textAlign: 'center' },
  rewardRow: { flexDirection: 'row', gap: space(3), marginTop: space(4) },
  reward: { flex: 1, alignItems: 'center', paddingVertical: space(5), borderRadius: radius.lg, gap: 2 },
  rewardValue: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.ink },
  rewardLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
});
