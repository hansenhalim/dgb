import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useDestinations } from "@/config/destinations";
import type { Destination } from "@/domain/entities";
import { POSITION_LABEL } from "@/domain/visitCard";
import { useTheme } from "@/theme/theme";
import { fonts, radius, type Colors } from "@/theme/tokens";

const MAX_VISIBLE_ROWS = 4;
const ROW_HEIGHT = 56;

const normalize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

type Match = {
  destination: Destination;
  prefix: boolean;
};

function rankMatches(query: string, list: Destination[]): Match[] {
  const q = normalize(query);
  if (q.length === 0) return [];
  const matches: Match[] = [];
  for (const d of list) {
    const n = normalize(d.name);
    const idx = n.indexOf(q);
    if (idx === -1) continue;
    matches.push({ destination: d, prefix: idx === 0 });
  }
  matches.sort((a, b) => {
    if (a.prefix !== b.prefix) return a.prefix ? -1 : 1;
    return a.destination.name.localeCompare(b.destination.name);
  });
  return matches;
}

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function TujuanAutocomplete({ value, onChange }: Props) {
  const { destinations, loading, error, fetch } = useDestinations();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const matches = useMemo(
    () => (focused && destinations ? rankMatches(value, destinations) : []),
    [focused, value, destinations],
  );

  const exactPosition = useMemo(() => {
    if (!destinations) return null;
    const hit = destinations.find((d) => d.name === value);
    return hit?.position ?? null;
  }, [destinations, value]);

  const ready = !!destinations;
  const showLoading = !ready && loading;
  const canRetry = !ready && !loading;
  const showError = canRetry && !!error;
  const showDropdown =
    focused && matches.length > 0 && dismissedFor !== value;

  const placeholder = showLoading
    ? "Memuat daftar tujuan…"
    : canRetry
      ? showError
        ? "Gagal memuat — Coba lagi"
        : "Ketuk untuk memuat tujuan"
      : "AA-1";

  const onPickMatch = useCallback(
    (name: string) => {
      onChange(name);
      setDismissedFor(name);
    },
    [onChange],
  );

  return (
    <View style={styles.outer}>
      <Pressable
        onPress={() => {
          if (canRetry) fetch();
          else if (ready) inputRef.current?.focus();
        }}
        hitSlop={12}
      >
        <View
          style={[
            styles.inputBox,
            !ready && styles.inputBoxDisabled,
            showError && styles.inputBoxError,
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.inputText, !ready && styles.inputTextDisabled]}
            value={value}
            onChangeText={onChange}
            keyboardType="visible-password"
            autoCorrect={false}
            placeholder={placeholder}
            placeholderTextColor={showError ? colors.red : colors.inkDim}
            editable={ready}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {ready && exactPosition ? (
            <Text style={styles.positionLabel}>{POSITION_LABEL[exactPosition]}</Text>
          ) : null}
        </View>
      </Pressable>

      {showDropdown ? (
        <View style={styles.dropdown}>
          <ScrollView
            style={{ maxHeight: ROW_HEIGHT * MAX_VISIBLE_ROWS }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {matches.map((m, idx) => (
              <Pressable
                key={m.destination.name}
                style={[styles.row, idx > 0 && styles.rowDivider]}
                onPress={() => onPickMatch(m.destination.name)}
              >
                <Text style={styles.rowName}>{m.destination.name}</Text>
                <Text style={styles.rowPosition}>{POSITION_LABEL[m.destination.position]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    outer: {
      gap: 4,
    },
    inputBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.ruleStrong,
      borderRadius: radius.base,
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    inputBoxDisabled: {
      backgroundColor: colors.rule,
    },
    inputBoxError: {
      borderColor: colors.red,
    },
    inputText: {
      flex: 1,
      padding: 0,
      fontSize: 18,
      color: colors.ink,
    },
    inputTextDisabled: {
      color: colors.inkMuted,
    },
    positionLabel: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.inkMuted,
      letterSpacing: 0.6,
    },
    dropdown: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.ruleStrong,
      borderRadius: radius.base,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 8,
      paddingHorizontal: 14,
      minHeight: ROW_HEIGHT,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.rule,
    },
    rowName: {
      fontSize: 15,
      color: colors.ink,
      fontWeight: "600",
    },
    rowPosition: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.inkMuted,
      letterSpacing: 0.6,
    },
  });
