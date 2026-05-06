if (!globalThis.navigator) {
  globalThis.navigator = {};
}

if (!globalThis.localStorage) {
  const store = {};
  globalThis.localStorage = {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
  };
}
