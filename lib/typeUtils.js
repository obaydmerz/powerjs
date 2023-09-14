// Generates an item code to be used in an Add-Type class

// Example:

// 1: generateMethodOrItem("foo", { "bar": "String" })
// ==> public static extern void foo(String bar);

// 2: generateMethodOrItem("foo", { "@": "String" })
// ==> public static extern String foo;

// 3: generateMethodOrItem("foo", { "@": "String", "bar": "int" })
// ==> public static extern String foo(int bar);

// Dll adds a [DllImport("xxx.dll", CharSet=CharSet.Auto)] before the item

export function generateMethodOrItem(
  name,
  def = ["void"], // first item is type, others are arg types, arg names are automaticlly generated
  dll = null
) {
  if (typeof name != "string") return;
  if (!Array.isArray(def)) return;

  const { isMethod, defenition, itemType } = getItemDefData(def);

  let args = [];

  for (let i = 0; i < defenition.length; i++) {
    args.push(defenition[i] + " arg" + i);
  }

  return `    ${
    typeof dll == "string"
      ? '[DllImport("' + dll + '", CharSet=CharSet.Auto)]\n        '
      : ""
  } public static extern ${itemType} ${name}${
    isMethod ? "(" + args.join(", ") + ")" : ""
  };\n`;
}

export function getItemDefData(defenition) {
  defenition = [...defenition];
  defenition[0] = defenition[0] || "void";

  let itemType = defenition.shift();
  let isMethod =
    itemType == "void" || defenition.length > 0 || defenition[1] == "@";
  return {
    isMethod,
    itemType,
    defenition: defenition.filter(
      (d) => !["@", ":", ".", "+", "-"].includes(d)
    ),
  };
}

export function generateAddType(dlls = {}) {
  var exec = "";

  for (const d in dlls) {
    if (Object.hasOwnProperty.call(dlls, d)) {
      const dll = dlls[d];

      var contents = "";
      for (const item in dll.defenition) {
        if (Object.hasOwnProperty.call(dll.defenition, item)) {
          contents += generateMethodOrItem(
            item,
            dll.defenition[item],
            dll.dllpath
          );
        }
      }

      exec += `Add-Type -Namespace DLL -Name ${d} -MemberDefinition @'
${contents}
'@`;
    }
  }

  return exec;
}

export function encodePS(thing) {
  switch (typeof thing) {
    case "symbol":
    case "string":
      return "'" + thing + "'";
    case "number":
    case "bigint":
      return thing;
    case "boolean":
      return thing ? "$True" : "$False";
    case "undefined":
      return "$null";
    case "object":
      if (thing == null) return "$Null";
      return 'D("' + JSON.stringify(thing) + '")';
    case "function":
      return "";
  }
}

export function generateDllDirectObj(dlls, exec) {
  var obj = {};

  for (const d in dlls) {
    if (Object.hasOwnProperty.call(dlls, d)) {
      const dll = dlls[d];
      obj[d] = {};

      for (const item in dll.defenition) {
        if (Object.hasOwnProperty.call(dll.defenition, item)) {
          const { isMethod, defenition, itemType } = getItemDefData(
            dll.defenition[item]
          );
          if (isMethod) {
            obj[d][item] = async function (...args) {
              return await exec(
                `[DLL.${d}]::${item}(${args.map(encodePS).join(", ")})`
              );
            };
          } else {
            Object.defineProperty(obj[d], item, {
              async get() {
                return await exec(`[DLL.${d}]::${item}`);
              },
              async set(v) {
                return await exec(`[DLL.${d}]::${item} = ${encodePS(v)}`);
              },
            });
          }
        }
      }
    }
  }

  return obj;
}
