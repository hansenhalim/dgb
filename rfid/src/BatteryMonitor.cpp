#include "BatteryMonitor.h"

static constexpr uint32_t EMIT_INTERVAL_MS = 30000;

bool BatteryMonitor::poll(uint32_t now, uint8_t &percent) {
  uint8_t current = readPercent();
  bool changed = ((int16_t)current != lastValue);
  bool tick = (now - lastEmitMs) >= EMIT_INTERVAL_MS;
  if (changed || tick) {
    lastValue = current;
    lastEmitMs = now;
    percent = current;
    return true;
  }
  return false;
}

uint8_t BatteryMonitor::readPercent() {
  // TODO(hardware): wire to ADC + voltage divider, or to a fuel gauge IC.
  // Until then, the firmware reports a fixed value so the BLE event channel
  // and the app's battery surface can be exercised end-to-end.
  return 100;
}
