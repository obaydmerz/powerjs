/**
 * A class that holds the result after an execution
 */
export class Result {
  /**
   * Private member to store the array data.
   * @private
   */
  private _$array: any[];

  /**
   * Get the array property.
   * @returns An array containing the data.
   */
  get $array(): any[];

  /**
   * Convert the Result object to a string.
   * @returns A string representation of the Result object.
   */
  toString(): string;

  /**
   * Constructor for the Result class.
   * @param obj - An object or an array to initialize the Result object.
   */
  constructor(obj: any);

  /**
   * Static method to convert a Result object to an array.
   * @param result - The Result object to convert.
   * @returns An array containing the data from the Result object.
   */
  static array(result: Result): any[];
}
