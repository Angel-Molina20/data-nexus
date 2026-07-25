import { useEffect, useState } from "react";
import { Outlet } from "react-router";

import { AppLayout } from "./layouts/AppLayout";
import {
  checkBackendHealthOnce,
  type BackendStatusValue,
} from "./services/health";

export function App() {
  const [backendStatus, setBackendStatus] =
    useState<BackendStatusValue>("checking");

  useEffect(() => {
    let isActive = true;

    void checkBackendHealthOnce().then((status) => {
      if (isActive) {
        setBackendStatus(status);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <AppLayout backendStatus={backendStatus}>
      <Outlet context={{ backendStatus } satisfies AppOutletContext} />
    </AppLayout>
  );
}

export interface AppOutletContext {
  backendStatus: BackendStatusValue;
}
