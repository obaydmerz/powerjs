import { ExtensionClass } from "./ext/index.js";

/**
 * Represents a utility class for interacting with PowerShell processes and extensions.
 */
declare class PowerJS {
  /**
   * Creates a new instance of the PowerJS class.
   * @param options Configuration options for the PowerJS instance.
   */
  constructor(options?: PowerJSOptions);

  /**
   * Imports a DLL for use in PowerShell scripts.
   * @param dllPath The path to the DLL file to import.
   * @param definition Definitions for the imported DLL functions.
   */
  importDll(dllPath: string, definition: Record<string, unknown>): void;

  /**
   * Extends the PowerJS instance with one or more extensions.
   * @param extensions One or more extension classes to add to the PowerJS instance.
   */
  extend(...extensions: ExtensionClass[]): void;

  /**
   * Initializes the PowerJS instance and starts the PowerShell process.
   * @param extensions One or more extension classes to add and start with the PowerJS instance.
   */
  start(...extensions: ExtensionClass[]): Promise<void>;

  /**
   * Executes a PowerShell command or script.
   * @param config Configuration options for the execution.
   * @returns A promise that resolves to the execution result.
   */
  exec(config: PowerJSExecConfig | string): Promise<PowerJSExecResult>;

  /**
   * An object containing direct access to imported DLL functions.
   * You can use this object to interact with imported DLLs directly.
   */
  dll: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

  // Add any additional methods or properties here if needed.
}

/**
 * Configuration options for a PowerJS instance.
 */
interface PowerJSOptions {
  additionalShellNames?: string[];
  runas?: boolean | RunAsConfig;
  autoStart?: boolean;
  extensions?: ExtensionClass[];
}

/**
 * Configuration options for running a PowerShell command or script.
 */
interface PowerJSExecConfig {
  command?: string;
  timeout?: number;
  safeTimeout?: boolean;
}

/**
 * Represents the result of executing a PowerShell command or script.
 */
interface PowerJSExecResult {
  out: string;
  err: string;
  json: Record<string, unknown>;
  timeout: boolean;
}

/**
 * Configuration options for running a PowerShell process with elevated privileges.
 */
interface RunAsConfig {
  user?: string;
  password?: string;
}