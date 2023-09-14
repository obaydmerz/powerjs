import { extractresult } from "../lib/utils.js";

export class ExecResult {
  #stdout = "";
  #stderr = "";
  #result = null;
  #err = null;

  get stdout() {
    return this.#stdout;
  }

  get stderr() {
    return this.#stderr;
  }

  get result() {
    return this.#result;
  }

  get err() {
    return this.#err;
  }

  get array() {
    const dt = this.#result;
    return Array.isArray(dt) ? dt : [dt];
  }

  toString() {
    return this.#stdout;
  }

  get success() {
    return this.#err.length == 0;
  }

  constructor(out, err) {
    this.#stdout = out;
    this.#stderr = err;

    const { json, errjson } = extractresult(out);
    this.#result = json;
    this.#err = errjson;
  }
}
