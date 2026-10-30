// Files under public/ (the scene, the panels, the chime) keep fixed names,
// and GitHub Pages lets a browser reuse them for up to 10 minutes. Each
// production build tags their URLs with its own id (see vite.config.ts), so
// fresh code is never paired with a stale scene left over from the last
// release. The dev server leaves URLs untouched.
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '';

export function withBuildId(url: string): string {
  return BUILD_ID === ''
    ? url
    : `${url}${url.includes('?') ? '&' : '?'}v=${BUILD_ID}`;
}
