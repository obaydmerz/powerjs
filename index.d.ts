import { Extension, ExtensionClass } from "./ext/index.js";
import { ExecResult } from "./lib/result.js";

/**
 * Represents options for configuring the PowerJS instance.
 */
interface PowerJSOptions {
  /**
   * Additional interpreters for PowerShell.
   *
   * Always the PowerJS class will add "powershell" and "pwsh" to the end of the list.
   */
  additionalShellNames?: string[];
  runas?: boolean | RunAsOptions;
  /**
   * Disable this if you want to do some stuff before start.
   *
   * Note: Shell is always spawned even if `autoStart` is set to false!
   */
  autoStart?: boolean;

  /**
   * Extensions to import.
   */
  extensions: ExtensionClass[];

  /**
   * DLLs to import.
   */
  dlls: Record<string, Record<string, string[]>>;
}

/**
 * Represents options for running PowerShell with elevated permissions.
 */
interface RunAsOptions {
  user?: string;
  password?: string;
}

/**
 * Represents the configuration for executing a PowerShell command or script.
 */
interface PowerJSExecConfig {
  /**
   * Your awesome command.
   *
   * Notes:
   *
   * 1- All variables is private for each run of a command. If you want to make them global, use `$global:your_variable_here`.
   *
   * 2- When you except an array as a return, wrap your output statement in a
   *
   * `,(your_statement)`
   */
  command: string;
  /**
   * Timeout is milliseconds.
   *
   * Set to `0` to disable timeout. ( NOT RECOMMENDED )
   */
  timeout?: number;
  /**
   * Does the timeout trigger a `resolve({...timeout: true})` or a `reject()`.
   */
  safeTimeout?: boolean;
}

/**
 * Represents the PowerJS class to interact with PowerShell shell.
 */
declare class PowerJS {
  /**
   * Creates a new instance of the PowerJS class.
   * @param options An optional configuration object.
   */
  constructor(options?: PowerJSOptions);

  /**
   * Starts the PowerJS shell and initializes the instance.
   * @param extensions Optional extensions to load on startup.
   * @throws If the shell cannot be initiated.
   * @returns A promise that resolves when PowerJS is started.
   */
  start(...extensions: Extension[]): Promise<void>;

  /**
   * Executes a PowerShell command or script.
   * @param config The configuration for the execution. Can be a string as a command.
   * @returns A promise that resolves with the execution result.
   * @throws If the shell isn't initiated yet.
   */
  exec(config: PowerJSExecConfig | String): Promise<ExecResult>;

  /**
   * Imports a DLL and its definitions for use in PowerShell commands.
   * @param dllpath The path to the DLL file.
   * @param defenition The DLL definitions.
   * @throws If DLLs cannot be imported after starting.
   */
  importDll(dllpath: string, defenition: Record<string, any>): void;

  /**
   * Get an extension by class or name.
   *
   * @param extClassOrName - The extension class or name to retrieve.
   * @returns The extension instance or undefined if not found.
   */
  getExtension(extClassOrName: string | ExtensionClass): Extension | undefined;

  /**
   * Extend PowerJS with custom extensions.
   *
   * @param extclasses - The extension classes to add to PowerJS.
   */
  extend(...extclasses: ExtensionClass[]): void;

  /**
   * Gets the DLL-related properties and methods.
   */
  readonly dll: {
    /**
     * Returns a copy of the imported DLLs and their definitions.
     */
    readonly [name: string]: Record<
      string,
      Record<string, Function | String | Number | Boolean>
    >;
  };
}

export { PowerJS, Extension, PowerJSOptions, RunAsOptions, PowerJSExecConfig };
