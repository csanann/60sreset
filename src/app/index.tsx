import { useEffect, useRef, useState } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { MAX_THOUGHT_LENGTH, type MockReflection, validateThought } from '@/lib/reset-contract';
import { requestReset } from '@/lib/request-reset';

type ResetState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; response: MockReflection }
  | { status: 'error'; message: string };

export default function HomeScreen() {
  const theme = useTheme();
  const [thoughts, setThoughts] = useState('');
  const [reset, setReset] = useState<ResetState>({ status: 'idle' });
  const pendingRequest = useRef<AbortController | null>(null);
  const [focused, setFocused] = useState(false);
  const loading = reset.status === 'loading';
  const canSubmit = !loading && validateThought(thoughts) === null;

  useEffect(() => () => {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
  }, []);

  async function submit() {
    if (!canSubmit || pendingRequest.current) return;
    Keyboard.dismiss();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setReset({ status: 'loading' });
    try {
      const response = await requestReset(thoughts, controller);
      if (pendingRequest.current === controller) setReset({ status: 'success', response });
    } catch {
      if (pendingRequest.current === controller) {
        setReset({ status: 'error', message: 'Could not get a mock reflection. Check your connection and try again.' });
      }
    } finally {
      if (pendingRequest.current === controller) pendingRequest.current = null;
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
              60sReset
            </Text>
            <Text style={[styles.prompt, { color: theme.text }]}>
              What&apos;s on your mind?
            </Text>
            <TextInput
              accessibilityLabel="What's on your mind?"
              accessibilityHint="Write your thoughts in your own words. Multiple lines are welcome."
              multiline
              maxLength={MAX_THOUGHT_LENGTH}
              editable={!loading}
              textAlignVertical="top"
              value={thoughts}
              onChangeText={(value) => {
                setThoughts(value);
                setReset({ status: 'idle' });
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Start anywhere. It doesn't need to make sense yet."
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: focused ? theme.text : theme.textSecondary,
                },
              ]}
            />
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              Up to 2,000 characters. Sent to the mock server when you reset; not saved or analysed by AI.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: loading }}
              disabled={!canSubmit}
              onPress={submit}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: canSubmit ? theme.text : theme.backgroundSelected,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Text style={[styles.buttonText, { color: canSubmit ? theme.background : theme.textSecondary }]}>
                {loading ? 'Getting mock reflection…' : 'Reset my thoughts'}
              </Text>
            </Pressable>
            {loading && (
              <Text accessibilityLiveRegion="polite" style={[styles.note, { color: theme.text }]}>
                Getting your mock reflection…
              </Text>
            )}
            {reset.status === 'error' && (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.responseText, { color: theme.text }]}>
                {reset.message}
              </Text>
            )}
            {reset.status === 'success' && (
              <View accessibilityLiveRegion="polite" style={[styles.response, { backgroundColor: theme.backgroundElement }]}>
                <Text accessibilityRole="header" style={[styles.responseTitle, { color: theme.text }]}>
                  {reset.response.label}
                </Text>
                <Text style={[styles.responseText, { color: theme.text }]}>
                  {reset.response.reflection}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 20 },
  title: { fontSize: 32, fontWeight: '700' },
  prompt: { fontSize: 22, fontWeight: '500' },
  note: { fontSize: 14, lineHeight: 21 },
  input: {
    minHeight: 180, maxHeight: 320, padding: 16, borderWidth: 2,
    borderRadius: 16, fontSize: 18, lineHeight: 28,
  },
  button: { minHeight: 52, padding: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  response: { padding: 20, borderRadius: 16, gap: 12 },
  responseTitle: { fontSize: 18, fontWeight: '600' },
  responseText: { fontSize: 17, lineHeight: 26 },
});
