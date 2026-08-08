import { useLocation, useNavigate } from "react-router";

import { resolveReturnPath } from "../navigation/navigationState";

export function useReturnNavigation(fallback: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = resolveReturnPath(location.state, fallback);

  return { returnTo, goBack: () => void navigate(returnTo) };
}
