const mockAsyncStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn(async (key) => store[key] ?? null),
    setItem: jest.fn(async (key, value) => {
      store[key] = value.toString();
      return null;
    }),
    removeItem: jest.fn(async (key) => {
      delete store[key];
      return null;
    }),
    clear: jest.fn(async () => {
      store = {};
      return null;
    }),
    getAllKeys: jest.fn(async () => Object.keys(store)),
  };
})();

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
