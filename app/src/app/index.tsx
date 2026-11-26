import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Body, H1 } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { chunky, colors, fonts, radius, space } from '@/theme';

export default function Welcome() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <Screen><ActivityIndicator color={colors.primary} style={{ marginTop: space(20) }} /></Screen>;
  }
  if (state.status === 'signedIn') {
    return <Redirect href={state.me.role === 'parent' ? '/parent' : '/child'} />;
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.logo}>⏱️✨</Text>
        <H1 style={{ textAlign: 'center' }}>ScreenTime</H1>
        <Body style={{ textAlign: 'center' }}>Gör uppdrag hemma och tjäna skärmtid.</Body>
      </View>

      <RoleCard
        emoji="🧒"
        title="Jag är barn"
        sub="Logga in med familjekod och din PIN"
        bg={colors.coral}
        edge={colors.coralDeep}
        onPress={() => router.push('/login/child')}
      />
      <RoleCard
        emoji="👩‍👧"
        title="Jag är förälder"
        sub="Logga in eller skapa familjens konto"
        bg={colors.primary}
        edge={colors.primaryDeep}
        onPress={() => router.push('/login/parent')}
      />
    </Screen>
  );
}

function RoleCard(props: { emoji: string; title: string; sub: string; bg: string; edge: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.title}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: props.bg, ...chunky(props.edge, pressed ? 1 : 6) },
        pressed && { transform: [{ translateY: 5 }] },
      ]}
    >
      <Text style={styles.cardEmoji}>{props.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{props.title}</Text>
        <Text style={styles.cardSub}>{props.sub}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space(2), paddingTop: space(12), paddingBottom: space(6) },
  logo: { fontSize: 60 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space(4), padding: space(5), borderRadius: radius.lg },
  cardEmoji: { fontSize: 44 },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 23, color: '#fff' },
  cardSub: { fontFamily: fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  chev: { fontFamily: fonts.displayBold, fontSize: 32, color: 'rgba(255,255,255,0.9)' },
});
