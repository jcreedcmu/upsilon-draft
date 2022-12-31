type Assets = {
  surnames: string[],
};

// Any data that goes here is effectively test data for consumption by
// unit tests. initAssets, which will be called early in
// initialization in actual execution, will overwrite it.
let assets: Assets = {
  surnames: ['foo', 'bar', 'baz'],
}

export async function initAssets() {
  assets = {
    surnames: (await (await fetch('assets/surnames.txt')).text())
      .split('\n').map(x => x.toLowerCase())
  };
}

export function getAssets(): Assets {
  return assets as Assets;
}
