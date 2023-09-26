/**
 * A class that holds the result after an execution
 */
export class Result<T> extends Array<T> {
  /**
   * @returns True if result is an array
   */
  get isArray(): boolean;

  /**
   * Constructor for the Result class.
   * @param obj - An object or an array to initialize the Result object.
   */
  constructor(obj: any);

  /**
   * Static method to convert a Result object to an array.
   * @returns An array containing the data from the Result object.
   */
  toArray(): any[];
}
