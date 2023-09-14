/**
 * Represents the result of executing a command or script.
 */
export declare class ExecResult {
  /**
   * Gets the standard output (stdout) from the command or script execution.
   */
  readonly stdout: string;

  /**
   * Gets the standard error (stderr) from the command or script execution.
   */
  readonly stderr: string;

  /**
   * Gets the result of the execution, which can be a string, object, or an array.
   */
  readonly result: any;

  /**
   * Gets any error or exception information from the execution.
   */
  readonly err: any;

  /**
   * Gets the result as an array, converting a single result to an array if needed.
   */
  readonly array: any[];

  /**
   * Returns the standard output (stdout) as a string.
   */
  toString(): string;

  /**
   * Indicates whether the execution was successful (no errors).
   */
  readonly success: boolean;

  /**
   * Creates a new ExecResult instance.
   * @param out The standard output (stdout) from the execution.
   * @param err The standard error (stderr) from the execution.
   */
  constructor(out: string, err: string);
}
