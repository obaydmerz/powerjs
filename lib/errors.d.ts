/**
 * A class that holds the error after an execution
 */
export class ErrorRecord extends Error {
  /**
   * The line number where the error occured.
   */
  line: number;
  /**
   * The position in the line where the error occured.
   */
  pos: number;
  /**
   * The error code returned.
   */
  code: string;

  constructor(line: number, pos: number, code: string);
}
