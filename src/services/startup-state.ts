let _validating = false;

export function setValidating(v: boolean) {
  _validating = v;
}

export function isValidating() {
  return _validating;
}
