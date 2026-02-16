if (typeof window !== 'undefined') {
  if (typeof window.$RefreshReg$ !== 'function') {
    window.$RefreshReg$ = () => {};
  }
  if (typeof window.$RefreshSig$ !== 'function') {
    window.$RefreshSig$ = () => () => {};
  }
}
