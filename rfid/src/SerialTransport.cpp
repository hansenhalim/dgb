#include "SerialTransport.h"

void SerialTransport::begin() {
  Serial.setRxBufferSize(1024);
  Serial.begin(115200);
}

void SerialTransport::poll() {
  if (pendingReady)
    return;

  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n') {
      buffer.trim();
      buffer.toUpperCase();
      pending = buffer;
      buffer = "";
      pendingReady = true;
      return;
    }
    buffer += c;
  }
}

bool SerialTransport::hasLine() { return pendingReady; }

String SerialTransport::readLine() {
  String out = pending;
  pending = "";
  pendingReady = false;
  return out;
}

void SerialTransport::sendLine(const String &message) {
  Serial.print(message);
  Serial.print('\n');
}
