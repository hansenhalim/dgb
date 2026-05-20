#pragma once
#include <Arduino.h>

class ITransport {
public:
  virtual ~ITransport() = default;
  virtual void begin() = 0;
  virtual void poll() = 0;
  virtual bool hasLine() = 0;
  virtual String readLine() = 0;
  virtual void sendLine(const String &message) = 0;
};
