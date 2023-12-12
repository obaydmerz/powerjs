import { spawn } from "child_process";
import { generateAddType, generateDllDirectObj } from "./lib/typeUtils.js";
import { assert, extractData } from "./lib/utils.js";
import { Extension } from "./ext/index.js";
import { Result } from "./lib/result.js";
import {
  ErrorRecord,
  IncompleteCommand,
  StartTimeoutException,
  TimeoutException,
  getError,
} from "./lib/errors.js";

const beforerun = `
  function Out {
    [CmdletBinding()]
    param (
      [Parameter(ValueFromPipeline = $true)]
      $o
    )
    return ConvertTo-Json($o) -Compress -Depth 2 -WarningAction SilentlyContinue
  }
  function Out-Error {
    $a = $o.FullyQualifiedErrorId;
    $b = $o.InvocationInfo.InvocationName;
    $c = $o.InvocationInfo.ScriptLineNumber;
    $d = $o.InvocationInfo.OffsetInLine;
    Write-Host('¬*{"code": "' + $a + '", "term": "' + $b + '", "line": ' + $c + ', "pos": ' + $d + '}*¬');
  }
  function Out-Default {
    [CmdletBinding()]
    param (
      [Parameter(ValueFromPipeline = $true)]
      $o
    )
    if(($o -is [System.Exception]) -or ($o -is [System.Management.Automation.ErrorRecord])) {
    Out-Error($o);
    }
    elseif ($Null -eq $o) {
    }
    else {
    $d = Out($o);
    Write-Host('¬¬' + $d + '¬¬')
    }
  }
  function In {
    [CmdletBinding()]
    param (
      [Parameter(ValueFromPipeline=$true)]
      $o,
      $d = 2
    )
    return ConvertFrom-Json($o) -Depth $d -AsHashtable -WarningAction SilentlyContinue 
  }
  function prompt { return "" }

`;

export class PowerJS {
  #queue = [];
  #child = null;

  #readout = null; // Null is used to ignore the first result
  #readerr = "";
  #started = false;
  #shell = "";

  #working = true; // Busy with an existing query! At first we are busy waiting ps init.

  #imported_dlls = {};
  #dll = {}; // An interface to directly interact with imported dlls!

  #timeouts = {
    start: null,
  };

  get dll() {
    return { ...this.#dll }; // Prevent dll sets
  }

  get shell() {
    // Used shell
    return this.#shell;
  }

  importDll(dllpath, defenition) {
    assert(this.#started, false, "Cannot import dlls after starting");

    const dllname = dllpath.match(/[^\\/]+\.dll$/g).reverse()[0];
    dllpath = dllpath.replace(/\\/g, "\\\\");
    if (dllname == undefined)
      throw new Error("The path should end with a *.dll");

    var name = dllname.split(".");
    name.pop();
    name = name.join("_");

    this.#imported_dlls[name] = this.#imported_dlls[name] || {
      dllpath,
      defenition: {},
    };
    this.#imported_dlls[name].defenition = {
      ...this.#imported_dlls[name].defenition,
      ...defenition,
    };
  }

  #extensions = {};

  getExtension(extClassOrName) {
    if (extClassOrName.prototype instanceof Extension) {
      return this.#extensions[extClassOrName];
    } else if (typeof extClassOrName == "string") {
      for (const extension of this.#extensions) {
        if (extension.name == extClassOrName) return extension;
      }
    }

    // Undefined?
  }

  extend(...extclasses) {
    for (let extclass of extclasses) {
      if (!(extclass.prototype instanceof Extension)) return;
      if (this.#extensions[extclass] != undefined) return;

      let extension = new extclass(this);

      this.#extensions[extclass] = extension;

      // Import DLLs
      extension.dll_imports =
        typeof extension.dll_imports == "object" ? extension.dll_imports : {};
      for (const dll_import in extension.dll_imports) {
        if (Object.hasOwnProperty.call(extension.dll_imports, dll_import)) {
          this.importDll(dll_import, extension.dll_imports[dll_import]);
        }
      }

      const extname =
        typeof extension.name == "string" && extension.name.length
          ? extension.name.toLowerCase().trim()
          : "extension";

      extension.name = extname;
    }
  }

  exit() {
    if (this.#child && this.#child.stdin) {
      // Send an exit command to the Python subprocess
      this.#child.stdin.write("exit()\n");
    }
  }

  async start(...extensions) {
    assert(this.#started, false, "Cannot start twice!");
    this.extend(...extensions);
    this.#child.stdin.write(generateAddType(this.#imported_dlls) + beforerun);
    this.#dll = generateDllDirectObj(this.#imported_dlls, this.exec.bind(this));
    this.#started = true;
    this.#timeouts.start = setTimeout(() => {
      this.#started = false;
      this.#working = false;
      throw new StartTimeoutException();
    }, 8000);
  }

  #findOptimalShell(additionalShellNames) {
    // Find optimal shell
    for (const sname of additionalShellNames) {
      try {
        this.#child = spawn(sname);
        this.#shell = sname;
        break;
      } catch (e) {
        // Report error?
      }
    }
  }

  #processPS() {
    if (this.#readout != null) {
      this.#process(
        this.#readout.substring(this.#readout.indexOf("\n") + 1).trim()
      );
    } else {
      this.#working = false; // Powershell Session is initiated!
      clearTimeout(this.#timeouts.start);
      assert(this.#readerr.length, 0, "Powershell init has an error!");
    } // No process() because we need to bypass introduction data (like Powershell version...)

    this.#readout = "";
    this.#readerr = "";
  }

  #processIncompleteCommand() {
    this.#readerr = "";
    this.#readout = "";
    if (this.#working && this.#queue[0]) {
      this.#child.stdin.write("\x03"); // Close that
      if (this.#queue[0].started)
        this.#queue.shift().trigger.incompleteCommand();
    }
  }

  #setChildStreams() {
    this.#child.stdout.on("data", (data) => {
      data = data.toString();
      if (data == "PS>") {
        this.#processPS();
      } else if (
        data.startsWith(">") &&
        this.#readout != null &&
        (this.#readout.length == 0 || this.#readout.endsWith("\n"))
      ) {
        this.#processIncompleteCommand();
      } else {
        if (this.#readout != null) this.#readout += data;
      }
    });

    this.#child.stderr.on("data", (data) => {
      this.#readerr += data;
    });
  }

  #update() {
    if (!this.#working) {
      if (
        typeof this.#queue[0] == "object" &&
        this.#queue[0].started == false
      ) {
        let command = this.#queue[0].command;
        this.#child.stdin.write("&{" + command.trim() + "}\n");
        this.#queue[0].started = true;
        this.#working = true;
      }
    }
    setTimeout(this.#update.bind(this), 200); // Update every 200ms
  }

  constructor({
    additionalShellNames = [],
    autoStart = true,
    extensions = [],
    dlls = {},
  } = {}) {
    additionalShellNames.push("pwsh", "powershell");

    dlls = typeof dlls == "object" ? dlls : {};
    for (const dll_import in dlls) {
      if (Object.hasOwnProperty.call(dlls, dll_import)) {
        this.importDll(dll_import, dlls[dll_import]);
      }
    }

    this.#findOptimalShell(additionalShellNames);
    if (this.#child == null) {
      throw new Error(
        "Cannot find a powershell interpreter! Try installing powershell or adding your one!"
      );
    }
    this.#setChildStreams();

    this.#update();

    if (autoStart) {
      this.start(...(Array.isArray(extensions) ? extensions : []));
    }
  }

  #process(out) {
    if (typeof this.#queue[0] == "object" && this.#queue[0].started)
      this.#queue.shift().resolve(out);
    this.#working = false;
  }

  exec(config = {}) {
    assert(this.#started, true, "The shell isn't initiated yet!!");
    if (typeof config == "string") config = { command: config };

    config = {
      command: "",
      timeout: 20000,
      ...(typeof config == "object" ? config : {}),
    };

    return new Promise((resolve, reject) => {
      let tm = null;
      if (config.timeout > 0) {
        tm = setTimeout(function () {
          reject(
            new TimeoutException(
              "Your code exceeded the timeout of " + config.timeout + "ms!"
            )
          );
        }, config.timeout);
      }
      this.#queue.push({
        ...config,
        started: false,
        trigger: {
          incompleteCommand() {
            reject(new IncompleteCommand());
          },
        },
        resolve(out) {
          if (tm != null) clearTimeout(tm);
          const { json, errjson } = extractData(out);

          if (errjson != null) {
            reject(getError(errjson));
            return;
          }

          resolve(
            typeof json != "object" ? json : json ? new Result(json) : null
          );
        },
      });
    });
  }
}

export { Extension, Result, ErrorRecord };
