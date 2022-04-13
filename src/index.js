import React, { Suspense } from "react";
import { Loader } from "semantic-ui-react";
import ReactDOM from "react-dom";
import "./index.css";
import "./i18n";
import App from "./App";
import * as serviceWorker from "./serviceWorker";

ReactDOM.render(
  <Suspense fallback={<Loader active></Loader>}>
    <App />
  </Suspense>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
