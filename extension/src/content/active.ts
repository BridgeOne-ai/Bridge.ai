// Whether Bridge.ai may act on this page: true once setup is finished, false again if it's turned off
// (consent withdrawn on the Options page), so tabs that are already open stop at once.
let on = false;
export const isActive = () => on;
export const setActive = (value: boolean) => { on = value; };
