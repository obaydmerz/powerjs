export class Result extends Array {
  #isArray = true;

  get isArray() {
    return this.#isArray;
  }

  constructor(obj) {
    if (Array.isArray(obj)) {
      super(...obj);
    }
    else {
      super();

      for (const key of Object.keys(obj)) {
        this[key] = obj[key];
      }
    }
  }

  toArray() {
    return this.#isArray ? this : [...this];
  }
}