import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorState, Screen } from '@/components/Screen';
import { Body, H1 } from '@/components/ui';
import { api, API_URL } from '@/lib/api';
import { chunky, colors, fonts, radius, space } from '@/theme';

export default function WhoAreYou() {
  const children = useQuery({ queryKey: ['children'], queryFn: api.children });

  return (
    <Screen refreshing={children.isRefetching} onRefresh={children.refetch}>
      <View style={styles.hero}>
        <Text style={styles.logo}>⏱️✨</Text>
        <H1 style={{ textAlign: 'center' }}>Vem är du?</H1>
        <Body style={{ textAlign: 'center' }}>Gör uppdrag hemma och tjäna skärmtid.</Body>
      </View>

      {children.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      {children.isError ? (
        <ErrorState message={`Kör backend på ${API_URL}?`} onRetry={() => children.refetch()} />
      ) : null}

      <View style={styles.grid}>
        {children.data?.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push({ pathname: '/child/[id]', params: { id: c.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Jag är ${c.name}`}
            style={({ pressed }) => [
              styles.kid,
              { backgroundColor: c.color, ...chunky('rgba(0,0,0,0.18)', pressed ? 1 : 6) },
              pressed && { transform: [{ translateY: 5 }] },
            ]}
          >
            <Text style={styles.kidAvatar}>{c.avatar}</Text>
            <Text style={styles.kidName}>{c.name}</Text>
            <Text style={styles.kidMeta}>Nivå {c.level} · {c.minutes} min</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => router.push('/parent')}
        style={({ pressed }) => [styles.parent, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        <Text style={styles.parentIcon}>👩‍👧</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.parentTitle}>Jag är förälder</Text>
          <Text style={styles.parentSub}>Godkänn uppdrag och se bevis</Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space(2), paddingTop: space(8), paddingBottom: space(4) },
  logo: { fontSize: 56 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4), justifyContent: 'center' },
  kid: { width: 150, aspectRatio: 0.85, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 4 },
  kidAvatar: { fontSize: 64 },
  kidName: { fontFamily: fonts.displayBold, fontSize: 24, color: '#fff' },
  kidMeta: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  parent: {
    marginTop: space(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
  },
  parentIcon: { fontSize: 30 },
  parentTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  parentSub: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  chev: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.inkSoft },
});
