#pragma once
#include <Arduino.h>

class BatteryMonitor {
public:
  // Returns true if the caller should emit `EVT BATT <percent>`. Triggers on
  // first poll, on level change, and every EMIT_INTERVAL_MS.
  bool poll(uint32_t now, uint8_t &percent);

private:
  uint8_t readPercent();
  uint32_t lastEmitMs = 0;
  int16_t lastValue = -1;
};
