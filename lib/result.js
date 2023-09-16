export class Result {
  #$array = null;

  get $array() {
    if (this.#$array != null) {
      return this.#$array;
    }
    return [...this, ($array = () => {})];
  }

  constructor(obj) {
    if (Array.isArray(obj)) this.#$array = obj;
    else
      for (const key of Object.keys(obj)) {
        this[key] = obj[key];
      }
  }

  // Static
  
  static array(result) {
    if (!(result instanceof Result)) return "";
    return result.$array;
  }
}
