type Assets = {
  surnames: string[],
};

let assets: Assets | undefined = undefined;

export async function initAssets() {
  assets = {
    surnames: (await (await fetch('../assets/surnames.txt')).text())
      .split('\n').map(x => x.toLowerCase())
  };
}

export function getAssets(): Assets {
  return assets as Assets;
}
