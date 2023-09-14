export const errBase = {
  CommandNotFoundException:
    "The term '$term' is not recognized as the name of a cmdlet, function, script file, or operable program.",
};

export function assert(v1, v2, err) {
  if (v2 != v1) {
    throw err;
  }
}

export function prettyPrintErr(errObj) {
  console.log(`----- ${errObj.err}
${(errBase[errObj.err] || "A error occured!").replace(
  /\$term/gm,
  errObj.data.InvocationName
)}
----- line ${errObj.data.ScriptLineNumber} pos ${errObj.data.OffsetInLine}`);
}

export function extractData(dt) {
  // Used to return json (order by last) or an empty object
  const out = dt.match(/¬¬([\s\S]+?)¬¬/gm) || [];
  const err = dt.match(/¬\*([\s\S]+?)\*¬/gm) || [];
  let json = null;
  let errjson = null;

  for (const i of out.reverse()) {
    try {
      json = JSON.parse(i.substring(2, i.length - 2).replace(/[\r\n]/gm, ""));
      break;
    } catch (error) {}
  }

  for (const i of err.reverse()) {
    try {
      errjson = JSON.parse(
        i.substring(2, i.length - 2).replace(/[\r\n]/gm, "")
      );
      break;
    } catch (error) {}
  }

  return {
    json,
    errjson,
  };
}
