import { Outlet } from "react-router";

import { AppLayout } from "./layouts/AppLayout";

export function App() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
