export class TimeoutException extends Error { }

export class StartTimeoutException extends Error {
  message = "Shell took too long to start!";
}

export class IncompleteCommand extends Error {
  message = "Your command is incomplete! Verify that you have closed quotes and blocks.";
}

export class ErrorRecord extends Error {
  message = "The statement '$term' caused an exception! ( $code )";
  line = 0;
  pos = 0;
  term = "";
  code = "";

  constructor(line, pos, code) {
    super();
    this.line = line;
    this.pos = pos;
    this.code = code;
  }
}

export class CommandNotFoundException extends ErrorRecord {
  message =
    "The term '$term' is not recognized as the name of a cmdlet, function, script file, or operable program.";
}

export const errorList = [ErrorRecord, CommandNotFoundException];

export function getErrorRecord(err) {
  const errClass = ErrorRecord;
  for (const e of errorList) {
    if (e.name.toLowerCase() == err.toLowerCase().trim()) {
      errClass = e;
    }
  }
  return errClass;
}

export function handleError(errObj, name = "<execution>") {
  const err = new (getErrorRecord(errObj.code))(
    errObj.line,
    errObj.pos,
    errObj.code
  );

  err.message = fillString(err.message, {
    term: errObj.term,
    code: errObj.code,
  });

  const stack = error.stack.split("\n");
  stack.splice(1, 0, `    at ${name}:${errObj.line}:${errObj.pos}`);
  error.stack = stack.join("\n");

  throw err;
}
