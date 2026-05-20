#pragma once
#include "ITransport.h"

class SerialTransport : public ITransport {
public:
  void begin() override;
  void poll() override;
  bool hasLine() override;
  String readLine() override;
  void sendLine(const String &message) override;

private:
  String buffer;
  String pending;
  bool pendingReady = false;
};
