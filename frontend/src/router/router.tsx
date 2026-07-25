import { createBrowserRouter } from "react-router";

import { App } from "../App";
import { ConnectionsPage } from "../pages/ConnectionsPage";
import { HomePage } from "../pages/HomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
    children: [
      { index: true, Component: HomePage },
      { path: "connections", Component: ConnectionsPage },
    ],
  },
]);
