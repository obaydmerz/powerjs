/**
 * Represents an extension class for extending the PowerJS functionality.
 */
declare export class Extension {
  /**
   * An object containing definitions of DLL imports for this extension.
   */
  dll_imports: Record<string, unknown>;

  /**
   * A reference to the instance of the PowerJS class that this extension is associated with.
   */
  instance: PowerJS | null;

  /**
   * The name of the extension.
   */
  name: string;

  /**
   * Creates a new instance of the Extension class.
   * @param instance The instance of the PowerJS class that this extension is associated with.
   */
  constructor(instance: PowerJS);

  // Add any additional methods or properties here if needed.
}

/**
 * Represents a class that can be extended by extension classes.
 */
declare class ExtensionClass {
  constructor(instance: PowerJS);
}
