export class Extension {
    dll_imports = {};
    instance = null;

    name = "extension";

    constructor(instance) { 
        this.instance = instance;
    }
}
