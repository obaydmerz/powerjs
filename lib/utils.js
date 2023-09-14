export function assert(v1, v2, err) {
  if (v2 != v1) {
    throw err;
  }
}

export function sniffJSON(out) {
  // Used to return json (order by last) or an empty object
  out = out.match(/[{\[][\s\S]+[}\]]/gm) || [];
  let json = {};

  for (const i of out.reverse()) {
    try {
      json = JSON.parse(i);
    } catch (error) {}
  }
  return json;
}
