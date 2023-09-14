# PowerJS - Empower Your JavaScript with PowerShell Magic

PowerJS is a powerful JavaScript library that enables you to seamlessly integrate and harness the magic of PowerShell directly from your scripts. Whether you need to automate administrative tasks, manage Windows processes, or interact with DLLs, PowerJS provides a user-friendly interface to supercharge your JavaScript applications.

### Key Features
- **100% Pure javascript (no native files included):** Enjoy more flexibility with a lower cost and a shorter setup process.

- **Dependency-less:** PowerJS eliminates the need for additional dependencies, ensuring a lightweight and hassle-free integration with your projects.

- **Seamless PowerShell Integration:** PowerJS enables you to execute PowerShell commands and scripts directly from your JavaScript or TypeScript code, making it easy to leverage the power of PowerShell within your application.

- **Extension Support:** Extend PowerJS functionality with ease by adding custom extensions. These extensions can include additional PowerShell modules, functions, and capabilities to tailor PowerJS to your specific needs. ( You can make your own extensions and publish them )

- **DLL Integration:** Import and interact with DLLs (Dynamic Link Libraries) in your PowerShell scripts. PowerJS simplifies the process of importing DLLs and provides a convenient interface for direct interaction.

- **Flexible Configuration:** Configure PowerJS according to your requirements with options like specifying additional shell names, enabling elevated permissions (runas), and automatic startup of extensions.

- **Robust Error Handling:** PowerJS includes robust error handling features, allowing you to capture and handle errors gracefully, ensuring your application remains stable even when executing complex PowerShell commands.

- **Asynchronous Execution:** Execute PowerShell commands asynchronously, preventing your application from becoming unresponsive while waiting for script execution to complete.

- **Detailed Results:** Access detailed results of PowerShell script executions, including standard output, standard error, and execution success status. PowerJS provides a convenient result object for easy data retrieval.

- **Comprehensive Documentation:** PowerJS includes comprehensive TypeScript declaration files (.d.ts) and inline code comments, making it easy to understand and use the module in your projects.

- **Cross-Platform Compatibility:** PowerJS is designed to work across different platforms, ensuring consistent PowerShell integration regardless of the operating system.

- ~~**Elevated Permissions:** Run PowerShell commands with elevated permissions when necessary, providing the ability to execute administrative tasks and interact with protected system resources.~~ **( Coming Soon... )**

## Installation
Currently there are a way to install it directly from github.
I will manage to push it to npm very soon!

```bash
npm install git+https://github.com/obaydmerz/powerjs.git
```

## Examples

```javascript
// Print PowerShell Version
import { PowerJS } from "@obaydmerz/powerjs";

const instance = new PowerJS(/* options */);

instance.exec("$PSVersionTable").then(({ result }) => {
  // You may notice some slowdown, that's because of the instance init process.
  // After the instance is started, you can enjoy a blazing fast environnement!
  console.log("Currently on Powershell v" + result.PSVersion.Major + "!");
})
```

```javascript
// Import a DLL
import { PowerJS } from "../index.js";

const instance = new PowerJS({
  dlls: {
    "user32.dll": {
      LockWorkStation: [], // Imports LockWorkStation as a function
      MessageBox: ["int", "IntPtr", "String", "String", "int"], // Also a function, Please note that the first item is the function type.
    },
  },
});

instance.dll.user32.MessageBox(0, "Lock your computer?", "Warning", 3).then(async ({ result }) => {
  if (result == 6) {
    await instance.dll.user32.LockWorkStation();
  }
});

// You should take a deep lock to see how this magic happens.
// This is a super easy out-of-the-box alternative to node-ffi.

```
```javascript
// Make an extension
import { PowerJS, Extension } from "../index.js";

class MyAwesomeExtension extends Extension {
  name = "myawesomeext";

  async getVersion() {
    const { result } = await this.instance.exec("$PSVersionTable");

    return result.PSVersion.Major;
  }
}

const instance = new PowerJS({
  extensions: [MyAwesomeExtension],
});

const myAwesomeExt = instance.getExtension(MyAwesomeExtension);
// OR: const myAwesomeExt = instance.getExtension("myawesomeext");

myAwesomeExt.getVersion().then((versionMajor) => {
  console.log("Huh ?! Powershell v" + versionMajor);
});
```

***Easy, isn't it?***

### Read more
For more information and advanced usage, check out the [PowerJS Wiki](https://github.com/obaydmerz/powerjs/wiki)
