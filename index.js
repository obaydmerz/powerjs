import { spawn } from "node:child_process";
import { generateAddType, generateDllDirectObj } from "./lib/typeUtils.js";
import { assert, extractData } from "./lib/utils.js";
import { Extension } from "./ext/index.js";
import { Result } from "./lib/result.js";
import {
  IncompleteCommand,
  TimeoutException,
  handleError,
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
    if (dllname == undefined) throw "The path should end with a *.dll";

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

  async start(...extensions) {
    assert(this.#started, false, "Cannot start twice!");
    this.extend(...extensions);
    this.#child.stdin.write(generateAddType(this.#imported_dlls) + beforerun);
    //console.log(generateAddType(this.#imported_dlls) + beforerun);
    this.#dll = generateDllDirectObj(this.#imported_dlls, this.exec.bind(this));
    this.#started = true;
  }

  constructor({
    additionalShellNames = [],
    runas = false,
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

    // Find optimal shell

    for (const sname of additionalShellNames) {
      try {
        this.#child = spawn(sname);
        this.#shell = sname;
        break;
      } catch (e) {}
    }

    if (this.#child == null) {
      throw "Cannot find a powershell interpreter! Try installing powershell or adding your one!";
    }

    // TODO: Make RunAs: Coming soon
    /* if (runas) {
      var command = "";
      if (typeof runas == "object") {
        command = `
$credentials = New-Object System.Management.Automation.PSCredential -ArgumentList @('${
          runas.user || ""
        }',(ConvertTo-SecureString -String '${
          runas.password || ""
        }' -AsPlainText -Force))
Start-Process ${this.#shell} -Credential ($credentials)
exit
`;
      } else {
        command = `
Start-Process ${this.#shell} -Verb runAs
exit
`;
      }
    } */

    this.#child.stdout.on("data", (data) => {
      data = data.toString();
      if (data == "PS>") {
        if (this.#readout != null) {
          this.#process(
            this.#readout.substring(this.#readout.indexOf("\n") + 1).trim()
          );
        } else {
          this.#working = false; // Powershell Session is initiated!
          assert(this.#readerr.length, 0, "Powershell init has an error!");
        } // No process() because we need to bypass introduction data (like Powershell version...)

        this.#readout = "";
        this.#readerr = "";
      } else if (
        data.startsWith(">") &&
        this.#readout != null &&
        (this.#readout.length == 0 || this.#readout.endsWith("\n"))
      ) {
        // Incomplete command!!!
        this.#readerr = "";
        this.#readout = "";
        if (this.#working && this.#queue[0]) {
          this.#child.stdin.write("\x03"); // Close that
          this.#queue.shift().trigger.incompleteCommand();
        }
      } else {
        if (this.#readout != null) this.#readout += data;
      }
    });

    this.#child.stderr.on("data", (data) => {
      this.#readerr += data;
    })

    const update = () => {
      if (!this.#working) {
        if (typeof this.#queue[0] == "object") {
          let command = this.#queue[0].command;
          this.#child.stdin.write("&{" + command + "}\n");
          this.#working = true;
        }
      }
      setTimeout(update, 200); // Update every 200ms
    };

    update();

    if (autoStart) {
      this.start(...(Array.isArray(extensions) ? extensions : []));
    }
  }

  #process(out) {
    if (typeof this.#queue[0] == "object")
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
        trigger: {
          incompleteCommand() {
            reject(new IncompleteCommand());
          },
        },
        resolve(out) {
          if (tm != null) clearTimeout(tm);
          const { json, errjson } = extractData(out);

          if (errjson != null) {
            return handleError(errjson);
          }

          resolve(new Result(json));
        },
      });
    });
  }
}

export { Extension, Result };
