import React from "react";
import ReactDOM from "react-dom/client";

// Bundled variable fonts, imported before the app's own styles so the
// @font-face rules exist by the time anything is painted. These replace a
// runtime @import from Google Fonts, which meant the app silently rendered
// in fallback system fonts whenever it was offline. Inter and Newsreader
// load with their optical-size axis ("opsz"), so letterforms adapt to the
// size they're set at rather than one drawing being stretched to serve
// both a 10px label and a dialog title.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/inter/opsz-italic.css";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource-variable/manrope";

import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
