export function resolveMapStartup(params: URLSearchParams) {
  const overview = params.get('autostart') !== '1';
  const useDefault = overview && !['terrain', 'entry', 'surface'].some(key => params.has(key));
  const baked = useDefault || params.get('terrain') === 'baked';
  const landmarks = overview && (useDefault || params.get('entry') === 'landmarks');
  const surface = useDefault ? 'stream' : params.get('surface');
  return { baked, landmarks, surface, streaming: baked && landmarks && surface === 'stream' };
}

export const mapStartup = resolveMapStartup(new URLSearchParams(globalThis.location?.search));
