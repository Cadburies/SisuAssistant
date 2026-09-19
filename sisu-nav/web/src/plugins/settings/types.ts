export type KeyRow = {
  env: string;
  label: string;
  kind: 'secret' | 'url' | 'text' | 'stub';
  usedBy?: string;
  help?: string | null;
  stub: boolean;
  stubMessage?: string;
  issue?: number;
  configured: boolean;
  preview: string | null;
  source: 'local' | 'env' | null;
};

export type SettingsCatalog = {
  keys: KeyRow[];
  precedence: string;
  store: string;
};
