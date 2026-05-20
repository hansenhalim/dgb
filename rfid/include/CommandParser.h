#pragma once
#include <Arduino.h>

enum class CommandCode {
  SCAN_UID,
  READ,
  WRITE,
  ENROLL,
  VERSION,
  HELP,
  UNKNOWN
};

enum class ParseError {
  NONE,
  UNKNOWN_COMMAND,
  INVALID_ARGUMENT_COUNT,
  INVALID_HEX_FORMAT,
  INVALID_HEX_LENGTH,
  MISSING_ARGUMENTS
};

struct ParsedCommand {
  CommandCode code;
  String arg1;
  String arg2;
  ParseError error;
  String errorDetails;
  String originalCommand;
};

class CommandParser {
public:
  static ParsedCommand parse(const String &cmd);
  static String getCommandHelp(const String &command);
  static String getAllCommandsHelp();

private:
  static bool isValidHexString(const String &str, int expectedLength);
  static ParsedCommand createErrorResult(const String &originalCmd,
                                         ParseError error,
                                         const String &details);
};
