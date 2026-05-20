#include "Response.h"

ITransport *Response::active = nullptr;

void Response::setTransport(ITransport *transport) { active = transport; }

void Response::emit(const String &line) {
  if (active)
    active->sendLine(line);
  else
    Serial.println(line);
}

void Response::sendOK(const String &message) { emit("OK " + message); }

void Response::sendError(const String &message) { emit("ERR " + message); }

void Response::sendVerboseError(const String &errorCode,
                                const String &description) {
  emit("ERR " + errorCode + " - " + description);
}

void Response::sendVerboseError(const String &errorCode,
                                const String &description,
                                const String &context) {
  emit("ERR " + errorCode + " - " + description + " (" + context + ")");
}

void Response::send(const String &message, ResponseStatus status) {
  if (status == ResponseStatus::OK)
    sendOK(message);
  else
    sendError(message);
}
