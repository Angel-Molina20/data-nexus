import { Navigate } from "react-router";

import { Card, CardContent } from "../components/ui/Card";
import { LoadingState } from "../components/ui/FeedbackStates";
import { AuthLayout } from "../features/auth/components/AuthLayout";
import { LoginBrandPanel } from "../features/auth/components/LoginBrandPanel";
import { LoginForm } from "../features/auth/components/LoginForm";
import { useAuth } from "../features/auth/context";

export function LoginPage() {
  const auth = useAuth();

  if (auth.user) {
    return (
      <Navigate replace to={auth.user.must_change_password ? "/account/change-password" : "/"} />
    );
  }

  return (
    <AuthLayout brand={<LoginBrandPanel />}>
      {auth.loading ? (
        <Card className="w-full max-w-[29rem]">
          <CardContent>
            <LoadingState label="Comprobando tu sesión…" />
          </CardContent>
        </Card>
      ) : (
        <LoginForm />
      )}
    </AuthLayout>
  );
}
