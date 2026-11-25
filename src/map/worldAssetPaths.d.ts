declare module 'virtual:world-asset-paths' {
  const paths: Record<'overview' | 'grass' | 'water' | 'terrain', string>;
  export default paths;
}

declare module 'virtual:waterfall-sites' {
  const sites: ReadonlyArray<import('./waterfalls').WaterfallSite>;
  export default sites;
}
