export function createJSONStorage(getStorage, options) {
  let storage;
  try {
    storage = getStorage();
  } catch (error) {
    return undefined;
  }

  return {
    getItem: (name) => {
      const parse = (value) => (value === null ? null : JSON.parse(value, options?.reviver));
      const value = storage.getItem(name) ?? null;
      return value instanceof Promise ? value.then(parse) : parse(value);
    },
    setItem: (name, value) => storage.setItem(name, JSON.stringify(value, options?.replacer)),
    removeItem: (name) => storage.removeItem(name),
  };
}

const toThenable = (fn) => (input) => {
  try {
    const result = fn(input);
    if (result instanceof Promise) return result;
    return {
      then(onFulfilled) {
        return toThenable(onFulfilled)(result);
      },
      catch() {
        return this;
      },
    };
  } catch (error) {
    return {
      then() {
        return this;
      },
      catch(onRejected) {
        return toThenable(onRejected)(error);
      },
    };
  }
};

export const persist = (config, baseOptions) => (set, get, api) => {
  let options = {
    storage: createJSONStorage(() => window.localStorage),
    partialize: (state) => state,
    version: 0,
    merge: (persistedState, currentState) => ({ ...currentState, ...persistedState }),
    ...baseOptions,
  };
  let hasHydrated = false;
  let hydrationVersion = 0;
  const hydrationListeners = new Set();
  const finishHydrationListeners = new Set();
  let storage = options.storage;

  if (!storage) {
    return config(
      (...args) => {
        console.warn(`[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`);
        set(...args);
      },
      get,
      api
    );
  }

  const setItem = () => {
    const state = options.partialize({ ...get() });
    return storage.setItem(options.name, { state, version: options.version });
  };

  const savedSetState = api.setState;
  api.setState = (state, replace) => {
    savedSetState(state, replace);
    return setItem();
  };

  const configResult = config(
    (...args) => {
      set(...args);
      return setItem();
    },
    get,
    api
  );
  api.getInitialState = () => configResult;

  let stateFromStorage;
  const hydrate = () => {
    if (!storage) return undefined;
    const currentVersion = ++hydrationVersion;
    hasHydrated = false;
    hydrationListeners.forEach((callback) => callback(get() ?? configResult));
    const postRehydrationCallback = options.onRehydrateStorage?.(get() ?? configResult) || undefined;

    return toThenable(storage.getItem.bind(storage))(options.name)
      .then((deserializedStorageValue) => {
        if (deserializedStorageValue) {
          if (typeof deserializedStorageValue.version === 'number' && deserializedStorageValue.version !== options.version) {
            if (options.migrate) {
              const migration = options.migrate(deserializedStorageValue.state, deserializedStorageValue.version);
              return migration instanceof Promise ? migration.then((result) => [true, result]) : [true, migration];
            }
            console.error("State loaded from storage couldn't be migrated since no migrate function was provided");
          } else {
            return [false, deserializedStorageValue.state];
          }
        }
        return [false, undefined];
      })
      .then((migrationResult) => {
        if (currentVersion !== hydrationVersion) return undefined;
        const [migrated, migratedState] = migrationResult;
        stateFromStorage = options.merge(migratedState, get() ?? configResult);
        set(stateFromStorage, true);
        return migrated ? setItem() : undefined;
      })
      .then(() => {
        if (currentVersion !== hydrationVersion) return;
        postRehydrationCallback?.(get(), undefined);
        stateFromStorage = get();
        hasHydrated = true;
        finishHydrationListeners.forEach((callback) => callback(stateFromStorage));
      })
      .catch((error) => {
        if (currentVersion !== hydrationVersion) return;
        postRehydrationCallback?.(undefined, error);
      });
  };

  api.persist = {
    setOptions: (newOptions) => {
      options = { ...options, ...newOptions };
      if (newOptions.storage) storage = newOptions.storage;
    },
    clearStorage: () => storage?.removeItem(options.name),
    getOptions: () => options,
    rehydrate: () => hydrate(),
    hasHydrated: () => hasHydrated,
    onHydrate: (callback) => {
      hydrationListeners.add(callback);
      return () => hydrationListeners.delete(callback);
    },
    onFinishHydration: (callback) => {
      finishHydrationListeners.add(callback);
      return () => finishHydrationListeners.delete(callback);
    },
  };

  if (!options.skipHydration) hydrate();
  return stateFromStorage || configResult;
};
