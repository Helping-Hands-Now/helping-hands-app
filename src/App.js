import React from "react";
import "./App.css";
import * as Sentry from "@sentry/browser";
import "semantic-ui-css/semantic.min.css";
import { GlobalStateProvider } from "./hooks/useGlobalState";

import FirebaseWrapper from "./components/FirebaseWrapper";

Sentry.init({
  dsn:
    "https://a9f85aae5a4044af885ddfbb06f51e0c@o399701.ingest.sentry.io/5257198",
});

export default function App() {
  return (
    <GlobalStateProvider>
      <FirebaseWrapper />
    </GlobalStateProvider>
  );
}
