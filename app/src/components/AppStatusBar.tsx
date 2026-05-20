import Constants from "expo-constants";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useServices } from "@/config/container";
import type { DiscoverOptions, RfidReaderStatus } from "@/domain/ports";
import { useTheme } from "@/theme/theme";
import { type Colors, fonts } from "@/theme/tokens";

import { Moon, Sun } from "./icons";
import { ReaderSheet } from "./ReaderSheet";

const appVersion = Constants.expoConfig?.version ?? "";

export type AppStatusBarHandle = {
  openReaderSheet: () => void;
};

export function useReaderStatus(): RfidReaderStatus {
  const { rfid } = useServices();
  const [status, setStatus] = useState<RfidReaderStatus>(rfid.getStatus());
  useEffect(() => {
    setStatus(rfid.getStatus());
    return rfid.onStatusChange(setStatus);
  }, [rfid]);
  return status;
}

export const AppStatusBar = forwardRef<AppStatusBarHandle>((_props, ref) => {
  const { rfid } = useServices();
  const { colors, scheme, toggle } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [status, setStatus] = useState<RfidReaderStatus>(rfid.getStatus());
  const [pairedId, setPairedId] = useState<string | null>(
    rfid.getPairedPeripheralId(),
  );
  const [pairedName, setPairedName] = useState<string | null>(
    rfid.getPairedPeripheralName(),
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  useImperativeHandle(ref, () => ({ openReaderSheet: () => setSheetOpen(true) }), []);

  useEffect(() => {
    setStatus(rfid.getStatus());
    setPairedId(rfid.getPairedPeripheralId());
    setPairedName(rfid.getPairedPeripheralName());
    return rfid.onStatusChange((s) => {
      setStatus(s);
      setPairedId(rfid.getPairedPeripheralId());
      setPairedName(rfid.getPairedPeripheralName());
    });
  }, [rfid]);

  const discover = useCallback(
    (options?: DiscoverOptions) => rfid.discover(options),
    [rfid],
  );

  const readConnectedRssi = useCallback(
    () => rfid.readConnectedRssi(),
    [rfid],
  );

  const pair = useCallback(
    async (id: string) => {
      await rfid.pair(id);
      setPairedId(rfid.getPairedPeripheralId());
      setPairedName(rfid.getPairedPeripheralName());
    },
    [rfid],
  );

  const reconnect = useCallback(async () => {
    await rfid.connect();
  }, [rfid]);

  const forget = useCallback(async () => {
    await rfid.forget();
    setPairedId(null);
    setPairedName(null);
  }, [rfid]);

  const connected = status.state === "connected";

  return (
    <>
      <View style={styles.bar}>
        <Text style={styles.text}>v{appVersion}</Text>
        <View style={styles.right}>
          <Pressable
            style={styles.chip}
            onPress={() => setSheetOpen(true)}
            hitSlop={8}
          >
            <View style={[styles.dot, !connected && styles.dotOff]} />
            <Text
              style={[
                styles.text,
                styles.chipText,
                !connected && styles.chipTextOff,
              ]}
            >
              READER
            </Text>
          </Pressable>
          {connected && status.batteryPercent !== null ? (
            <Text style={styles.text}>{status.batteryPercent}%</Text>
          ) : null}
          <Pressable
            onPress={toggle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              scheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {scheme === "dark" ? (
              <Sun size={14} color={colors.inkMuted} />
            ) : (
              <Moon size={14} color={colors.inkMuted} />
            )}
          </Pressable>
        </View>
      </View>

      <ReaderSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        pairedReaderId={pairedId}
        pairedReaderName={pairedName}
        readerState={status.state}
        readerBatteryPercent={status.batteryPercent}
        discoverReaders={discover}
        readConnectedRssi={readConnectedRssi}
        pairReader={pair}
        reconnectReader={reconnect}
        forgetReader={forget}
      />
    </>
  );
});
AppStatusBar.displayName = "AppStatusBar";

const makeStyles = (colors: Colors) => StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkMuted,
    letterSpacing: 0.8,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  dotOff: {
    backgroundColor: colors.inkMuted,
  },
  chipText: {
    color: colors.green,
  },
  chipTextOff: {
    color: colors.inkMuted,
  },
});
