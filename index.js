import { spawn } from "node:child_process";
import { generateAddType, generateDllDirectObj } from "./lib/typeUtils.js";
import { assert, prettyPrintErr } from "./lib/utils.js";
import { Extension } from "./ext/index.js";
import { ExecResult } from "./lib/result.js";

const beforerun = `
  function Out {
    [CmdletBinding()]
    param (
      [Parameter(ValueFromPipeline = $true)]
      $o
    )

    return ConvertTo-Json($o) -Compress -Depth 2 -WarningAction SilentlyContinue
  }

  function Out-Default {
    [CmdletBinding()]
    param (
      [Parameter(ValueFromPipeline = $true)]
      $o
    )

    if($o.GetType() -eq [System.Management.Automation.ErrorRecord]) {
      $d = Out($o.InvocationInfo);
      $i = $o.FullyQualifiedErrorId;
      Write-Host('¬*{"err": "' + $i + '", "data": ' + $d + '}*¬')
    }
    elseif ($Null -eq $o) {
      Write-Host('¬¬null¬¬')
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
      if (data == "PS>") {
        if (this.#readout != null) {
          this.#process(
            this.#readout.substring(this.#readout.indexOf("\n") + 1).trim(),
            this.#readerr.trim()
          );
        } else {
          this.#working = false; // Powershell Session is initiated!
          assert(this.#readerr.length, 0, "Powershell init has an error!");
        } // No process() because we need to bypass introduction data (like Powershell version...)

        this.#readout = "";
        this.#readerr = "";
      } else {
        if (this.#readout != null) this.#readout += data;
      }
    });

    this.#child.stderr.on("data", (data) => {
      this.#readerr += data;
    });

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

  #process(out, err) {
    if (typeof this.#queue[0] == "object") {
      const q = this.#queue.shift();
      const res = new ExecResult(out, err);
      if (res.err != null) prettyPrintErr(res.err);
      q.resolve(res);
    }
    this.#working = false;
  }

  exec(config = {}) {
    assert(this.#started, true, "The shell isn't initiated yet!!");
    if (typeof config == "string") config = { command: config };

    config = {
      command: "",
      timeout: 20000,
      safeTimeout: true,
      ...(typeof config == "object" ? config : {}),
    };

    return new Promise((resolve, reject) => {
      let tm = null;
      if (config.timeout > 0) {
        tm = setTimeout(function () {
          if (config.safeTimeout) {
            resolve({ out: "", err: "", json: {}, timeout: true });
          } else reject();
        }, config.timeout);
      }
      this.#queue.push({
        ...config,
        resolve(...data) {
          if (tm != null) clearTimeout(tm);
          resolve(...data);
        },
      });
    });
  }
}

export { Extension };
